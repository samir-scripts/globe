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
GEO_URL = "https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/master/csv/countries.csv"
DATA_DIR = "backend/data"
CSV_FILE = os.path.join(DATA_DIR, "homicide_data.csv")
TEMP_CSV_FILE = os.path.join(DATA_DIR, "temp_homicide_data.csv")
PARQUET_FILE = os.path.join(DATA_DIR, "homicide_data.parquet")
GEO_CSV_FILE = os.path.join(DATA_DIR, "countries.csv")

def get_file_hash(filepath):
    """Calculate SHA256 hash of a file."""
    if not os.path.exists(filepath):
        return None
    sha256_hash = hashlib.sha256()
    with open(filepath, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

def fetch_worldbank_data():
    """Fetch data from World Bank API and save to a temporary CSV file."""
    print(f"Fetching data from {URL}...")
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        
        print(f"Fetching geographic data from {GEO_URL}...")
        geo_response = requests.get(GEO_URL)
        geo_response.raise_for_status()
        with open(GEO_CSV_FILE, mode='w', encoding='utf-8') as f:
            f.write(geo_response.text)

        response = requests.get(URL)
        response.raise_for_status()
        
        data_list = response.json()
        if not isinstance(data_list, list) or len(data_list) < 2:
            print("No data found in the response or unexpected format.")
            return False

        records = data_list[1]
        
        with open(TEMP_CSV_FILE, mode='w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(["Country", "ISO3", "Year", "Homicide Rate"])
            
            for record in records:
                country = record.get("country", {}).get("value")
                iso3 = record.get("countryiso3code")
                year = record.get("date")
                value = record.get("value")
                
                if value is not None:
                    writer.writerow([country, iso3, year, value])
        return True
    except Exception as e:
        print(f"Error fetching data: {e}")
        return False

def process_and_load_data():
    """Process CSV to Parquet and load into PostgreSQL."""
    print("Processing data with Polars...")
    try:
        df_homicide = pl.scan_csv(CSV_FILE)
        df_homicide = df_homicide.with_columns([
            pl.col("Year").cast(pl.Int32),
            pl.col("Homicide Rate").cast(pl.Float64)
        ])
        
        df_geo = pl.scan_csv(GEO_CSV_FILE, ignore_errors=True)
        
        df_joined = df_homicide.join(
            df_geo.select(["iso3", "latitude", "longitude"]),
            left_on="ISO3",
            right_on="iso3",
            how="left"
        )
        
        df = df_joined.collect()
        
        df.write_parquet(PARQUET_FILE)
        print(f"Data saved as parquet to {PARQUET_FILE}")
        
        db_user = os.getenv("DB_USER", "postgres")
        db_password = os.getenv("PASSWORD", "yeezus9090")
        db_host = os.getenv("DB_HOST", "localhost")
        db_port = os.getenv("PORT", "5432")
        db_name = os.getenv("NAME", "globe")
        
        connection_uri = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
        
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
    """Main pipeline entry point with change detection."""
    if not fetch_worldbank_data():
        return "Failed to fetch data."

    new_hash = get_file_hash(TEMP_CSV_FILE)
    old_hash = get_file_hash(CSV_FILE)

    if new_hash == old_hash:
        print("Data is identical to the current version. Discarding update.")
        os.remove(TEMP_CSV_FILE)
        return "No updates found. Data discarded."
    else:
        print("New data detected or first run. Updating CSV and running pipeline...")
        if os.path.exists(CSV_FILE):
            os.remove(CSV_FILE)
        os.rename(TEMP_CSV_FILE, CSV_FILE)
        
        if process_and_load_data():
            return "Data updated and loaded successfully."
        else:
            return "Data update failed during processing/loading."

if __name__ == "__main__":
    # Local execution for testing
    print(run_pipeline())
