import requests
import csv
import os
import polars as pl
import hashlib
from dotenv import load_dotenv

# Load environment variables from root first, then backend folder
load_dotenv(dotenv_path=".env")
load_dotenv(dotenv_path="backend/.env")

# Configuration
INDICATOR = "VC.IHR.PSRC.P5"
URL = f"https://api.worldbank.org/v2/country/all/indicator/{INDICATOR}?format=json&per_page=20000"

SEXUAL_VIOLENCE_INDICATOR = "SG.VAW.1549.ZS"
SEXUAL_VIOLENCE_URL = f"https://api.worldbank.org/v2/country/all/indicator/{SEXUAL_VIOLENCE_INDICATOR}?format=json&per_page=20000"

SEXUAL_VIOLENCE_ME_INDICATOR = "SG.VAW.1549.ME.ZS"
SEXUAL_VIOLENCE_ME_URL = f"https://api.worldbank.org/v2/country/all/indicator/{SEXUAL_VIOLENCE_ME_INDICATOR}?format=json&per_page=20000"

DATA_DIR = "backend/data"
CSV_FILE = os.path.join(DATA_DIR, "homicide_data.csv")
TEMP_CSV_FILE = os.path.join(DATA_DIR, "temp_homicide_data.csv")

SEXUAL_VIOLENCE_CSV = os.path.join(DATA_DIR, "sexual_violence_data.csv")
TEMP_SEXUAL_VIOLENCE_CSV = os.path.join(DATA_DIR, "temp_sexual_violence_data.csv")

SEXUAL_VIOLENCE_ME_CSV = os.path.join(DATA_DIR, "sexual_violence_me_data.csv")
TEMP_SEXUAL_VIOLENCE_ME_CSV = os.path.join(DATA_DIR, "temp_sexual_violence_me_data.csv")

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
    """Fetch all datasets to their respective temporary CSV files."""
    homicide_success = fetch_indicator_data(URL, TEMP_CSV_FILE, "Homicide Rate")
    sv_success = fetch_indicator_data(SEXUAL_VIOLENCE_URL, TEMP_SEXUAL_VIOLENCE_CSV, "sexual_violence")
    sv_me_success = fetch_indicator_data(SEXUAL_VIOLENCE_ME_URL, TEMP_SEXUAL_VIOLENCE_ME_CSV, "sexual_violence_me")
    return homicide_success and sv_success and sv_me_success

def process_and_load_data():
    """Process CSV files using Polars LazyFrames, join and coalesce them, and load into PostgreSQL."""
    print("Processing data with Polars...")
    try:
        # Read all CSVs into Polars LazyFrames
        lf_homicide = pl.scan_csv(CSV_FILE)
        lf_sv = pl.scan_csv(SEXUAL_VIOLENCE_CSV)
        lf_sv_me = pl.scan_csv(SEXUAL_VIOLENCE_ME_CSV)
        
        # Cast columns to correct types
        lf_homicide = lf_homicide.with_columns([
            pl.col("Year").cast(pl.Int32),
            pl.col("Homicide Rate").cast(pl.Float64)
        ])
        lf_sv = lf_sv.with_columns([
            pl.col("Year").cast(pl.Int32),
            pl.col("sexual_violence").cast(pl.Float64)
        ])
        lf_sv_me = lf_sv_me.with_columns([
            pl.col("Year").cast(pl.Int32),
            pl.col("sexual_violence_me").cast(pl.Float64)
        ])
        
        # Coalesce the sexual violence and modeled estimates
        lf_sv_combined = lf_sv.join(
            lf_sv_me,
            on=["Country", "ISO3", "Year"],
            how="full"
        ).with_columns([
            pl.coalesce("Country", "Country_right").alias("Country"),
            pl.coalesce("ISO3", "ISO3_right").alias("ISO3"),
            pl.coalesce("Year", "Year_right").alias("Year"),
            pl.coalesce("sexual_violence", "sexual_violence_me").alias("sexual_violence")
        ]).drop(["Country_right", "ISO3_right", "Year_right", "sexual_violence_me"])
        
        # Join horizontally on Country, ISO3, Year
        lf_joined = lf_homicide.join(
            lf_sv_combined,
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
        db_password = os.getenv("PASSWORD", "yeezus9090")
        db_host = os.getenv("DB_HOST", "localhost")
        db_name = os.getenv("NAME", "globe")
        
        # Determine the ports to write to
        configured_port = os.getenv("DB_PORT") or os.getenv("PORT")
        ports_to_try = []
        if configured_port:
            ports_to_try.append(configured_port)
        for p in ["5435", "5432"]:
            if p not in ports_to_try:
                ports_to_try.append(p)
                
        write_success = False
        import psycopg2
        
        for port in ports_to_try:
            connection_uri = f"postgresql://{db_user}:{db_password}@{db_host}:{port}/{db_name}"
            print(f"Attempting connection to PostgreSQL on port {port}...")
            try:
                conn = psycopg2.connect(connection_uri)
                conn.autocommit = True
                with conn.cursor() as cursor:
                    cursor.execute('DROP TABLE IF EXISTS total_statistics CASCADE;')
                conn.close()
                
                print(f"Loading data into 'total_statistics' table on port {port} using ADBC...")
                df.write_database(
                    table_name="total_statistics",
                    connection=connection_uri,
                    engine="adbc",
                    if_table_exists="replace"
                )
                print(f"Successfully loaded data into PostgreSQL on port {port}.")
                write_success = True
            except Exception as conn_err:
                print(f"Skipped loading database on port {port}: {conn_err}")
                
        return write_success
    except Exception as e:
        print(f"Error during processing/loading: {e}")
        return False

def run_pipeline():
    """Main pipeline entry point with change detection for all datasets."""
    # Ensure any previous temp files are cleared
    for temp_file in [TEMP_CSV_FILE, TEMP_SEXUAL_VIOLENCE_CSV, TEMP_SEXUAL_VIOLENCE_ME_CSV]:
        if os.path.exists(temp_file):
            os.remove(temp_file)

    if not fetch_worldbank_data():
        # Clean up any partial temp files
        for temp_file in [TEMP_CSV_FILE, TEMP_SEXUAL_VIOLENCE_CSV, TEMP_SEXUAL_VIOLENCE_ME_CSV]:
            if os.path.exists(temp_file):
                os.remove(temp_file)
        return "Failed to fetch data."

    homicide_changed = get_file_hash(TEMP_CSV_FILE) != get_file_hash(CSV_FILE)
    sv_changed = get_file_hash(TEMP_SEXUAL_VIOLENCE_CSV) != get_file_hash(SEXUAL_VIOLENCE_CSV)
    sv_me_changed = get_file_hash(TEMP_SEXUAL_VIOLENCE_ME_CSV) != get_file_hash(SEXUAL_VIOLENCE_ME_CSV)

    if not homicide_changed and not sv_changed and not sv_me_changed:
        print("All datasets are identical to the current versions. Discarding update.")
        for temp_file in [TEMP_CSV_FILE, TEMP_SEXUAL_VIOLENCE_CSV, TEMP_SEXUAL_VIOLENCE_ME_CSV]:
            if os.path.exists(temp_file):
                os.remove(temp_file)
        # Still process and load once to ensure database tables are filled in case they were dropped/out of sync
        print("Forcing processing/loading to ensure PostgreSQL columns are correct...")
        if process_and_load_data():
            return "No updates found, but database was successfully re-synchronized."
        else:
            return "No updates found, and database re-synchronization failed."
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

        if sv_me_changed:
            if os.path.exists(SEXUAL_VIOLENCE_ME_CSV):
                os.remove(SEXUAL_VIOLENCE_ME_CSV)
            os.rename(TEMP_SEXUAL_VIOLENCE_ME_CSV, SEXUAL_VIOLENCE_ME_CSV)
        else:
            if os.path.exists(TEMP_SEXUAL_VIOLENCE_ME_CSV):
                os.remove(TEMP_SEXUAL_VIOLENCE_ME_CSV)
        
        if process_and_load_data():
            return "Data updated and loaded successfully."
        else:
            return "Data update failed during processing/loading."

if __name__ == "__main__":
    # Local execution for testing
    print(run_pipeline())
