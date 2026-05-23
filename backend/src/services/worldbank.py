import requests
import csv
import os
import polars as pl
import hashlib
from dotenv import load_dotenv

# Load environment variables
load_dotenv(dotenv_path="backend/.env")

# Configuration
INDICATOR = "VC.IHR.PSRC.P5"
URL = f"https://api.worldbank.org/v2/country/all/indicator/{INDICATOR}?format=json&per_page=20000"
SEXUAL_VIOLENCE_INDICATOR = "SG.VAW.1549.ZS"
SEXUAL_VIOLENCE_URL = f"https://api.worldbank.org/v2/country/all/indicator/{SEXUAL_VIOLENCE_INDICATOR}?format=json&per_page=20000"

DATA_DIR = "backend/data"
CSV_FILE = os.path.join(DATA_DIR, "homicide_data.csv")
TEMP_CSV_FILE = os.path.join(DATA_DIR, "temp_homicide_data.csv")
SEXUAL_VIOLENCE_CSV = os.path.join(DATA_DIR, "sexual_violence_data.csv")
TEMP_SEXUAL_VIOLENCE_CSV = os.path.join(DATA_DIR, "temp_sexual_violence_data.csv")
PARQUET_FILE = os.path.join(DATA_DIR, "homicide_data.parquet")

def get_file_hash(filepath):
    """Calculate SHA256 hash of a file."""
    if not os.path.exists(filepath):
        return None
    sha256_hash = hashlib.sha256()
    with open(filepath, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

def fetch_indicator_data(url, temp_csv_filepath, value_column_name):
    """Fetch data from World Bank API for a specific indicator and save to a temporary CSV file."""
    print(f"Fetching data from {url}...")
    try:
        response = requests.get(url)
        response.raise_for_status()
        
        data_list = response.json()
        if not isinstance(data_list, list) or len(data_list) < 2:
            print(f"No data found in the response or unexpected format for {value_column_name}.")
            return False

        records = data_list[1]
        os.makedirs(DATA_DIR, exist_ok=True)
        
        with open(temp_csv_filepath, mode='w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(["Country", "ISO3", "Year", value_column_name])
            
            for record in records:
                country = record.get("country", {}).get("value")
                iso3 = record.get("countryiso3code")
                year = record.get("date")
                value = record.get("value")
                
                # Filter out records where values, countries, or ISO3 are null/empty
                if value is not None and country is not None and iso3 is not None and iso3 != "":
                    writer.writerow([country, iso3, year, value])
        return True
    except Exception as e:
        print(f"Error fetching data for {value_column_name}: {e}")
        return False

def fetch_worldbank_data():
    """Fetch both datasets to their respective temporary CSV files."""
    homicide_success = fetch_indicator_data(URL, TEMP_CSV_FILE, "Homicide Rate")
    sv_success = fetch_indicator_data(SEXUAL_VIOLENCE_URL, TEMP_SEXUAL_VIOLENCE_CSV, "sexual_violence")
    return homicide_success and sv_success

def process_and_load_data():
    """Process CSV files using Polars LazyFrames, join them horizontally, and load into PostgreSQL."""
    print("Processing data with Polars...")
    try:
        # Read both CSVs into Polars LazyFrames
        lf_homicide = pl.scan_csv(CSV_FILE)
        lf_sv = pl.scan_csv(SEXUAL_VIOLENCE_CSV)
        
        # Cast columns to correct types
        lf_homicide = lf_homicide.with_columns([
            pl.col("Year").cast(pl.Int32),
            pl.col("Homicide Rate").cast(pl.Float64)
        ])
        lf_sv = lf_sv.with_columns([
            pl.col("Year").cast(pl.Int32),
            pl.col("sexual_violence").cast(pl.Float64)
        ])
        
        # Join horizontally on Country, ISO3, Year
        lf_joined = lf_homicide.join(
            lf_sv,
            on=["Country", "ISO3", "Year"],
            how="full"
        ).with_columns([
            pl.coalesce("Country", "Country_right").alias("Country"),
            pl.coalesce("ISO3", "ISO3_right").alias("ISO3"),
            pl.coalesce("Year", "Year_right").alias("Year")
        ]).drop(["Country_right", "ISO3_right", "Year_right"])
        
        df = lf_joined.collect()
        
        df.write_parquet(PARQUET_FILE)
        print(f"Joined data saved as parquet to {PARQUET_FILE}")
        
        db_user = os.getenv("DB_USER", "postgres")
        db_password = os.getenv("PASSWORD")
        db_host = os.getenv("DB_HOST", "localhost")
        db_port = os.getenv("DB_PORT", "5432")
        db_name = os.getenv("NAME", "globe")
        
        connection_uri = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
        
        print("Dropping total_statistics table (with CASCADE) to update schema and handle views...")
        import psycopg2
        conn = psycopg2.connect(connection_uri)
        conn.autocommit = True
        with conn.cursor() as cursor:
            cursor.execute('DROP TABLE IF EXISTS total_statistics CASCADE;')
        conn.close()
        
        print(f"Loading data into 'total_statistics' table using ADBC...")
        df.write_database(
            table_name="total_statistics",
            connection=connection_uri,
            engine="adbc",
            if_table_exists="replace"
        )
        print("Successfully loaded data into PostgreSQL.")
        return True
    except Exception as e:
        print(f"Error during processing/loading: {e}")
        return False

def run_pipeline():
    """Main pipeline entry point with change detection for both datasets."""
    # Ensure any previous temp files are cleared
    for temp_file in [TEMP_CSV_FILE, TEMP_SEXUAL_VIOLENCE_CSV]:
        if os.path.exists(temp_file):
            os.remove(temp_file)

    if not fetch_worldbank_data():
        # Clean up any partial temp files
        for temp_file in [TEMP_CSV_FILE, TEMP_SEXUAL_VIOLENCE_CSV]:
            if os.path.exists(temp_file):
                os.remove(temp_file)
        return "Failed to fetch data."

    homicide_changed = get_file_hash(TEMP_CSV_FILE) != get_file_hash(CSV_FILE)
    sv_changed = get_file_hash(TEMP_SEXUAL_VIOLENCE_CSV) != get_file_hash(SEXUAL_VIOLENCE_CSV)

    if not homicide_changed and not sv_changed:
        print("Both datasets are identical to the current versions. Discarding update.")
        if os.path.exists(TEMP_CSV_FILE):
            os.remove(TEMP_CSV_FILE)
        if os.path.exists(TEMP_SEXUAL_VIOLENCE_CSV):
            os.remove(TEMP_SEXUAL_VIOLENCE_CSV)
        return "No updates found. Data discarded."
    else:
        print("New data detected. Updating CSV files and running pipeline...")
        if homicide_changed:
            if os.path.exists(CSV_FILE):
                os.remove(CSV_FILE)
            os.rename(TEMP_CSV_FILE, CSV_FILE)
        else:
            if os.path.exists(TEMP_CSV_FILE):
                os.remove(TEMP_CSV_FILE)

        if sv_changed:
            if os.path.exists(SEXUAL_VIOLENCE_CSV):
                os.remove(SEXUAL_VIOLENCE_CSV)
            os.rename(TEMP_SEXUAL_VIOLENCE_CSV, SEXUAL_VIOLENCE_CSV)
        else:
            if os.path.exists(TEMP_SEXUAL_VIOLENCE_CSV):
                os.remove(TEMP_SEXUAL_VIOLENCE_CSV)
        
        if process_and_load_data():
            return "Data updated and loaded successfully."
        else:
            return "Data update failed during processing/loading."

if __name__ == "__main__":
    # Local execution for testing
    print(run_pipeline())
