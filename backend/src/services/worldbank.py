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
DATA_DIR = "backend/data"
CSV_FILE = os.path.join(DATA_DIR, "homicide_data.csv")
TEMP_CSV_FILE = os.path.join(DATA_DIR, "temp_homicide_data.csv")
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

def fetch_worldbank_data():
    """Fetch data from World Bank API and save to a temporary CSV file."""
    print(f"Fetching data from {URL}...")
    try:
        response = requests.get(URL)
        response.raise_for_status()
        
        data_list = response.json()
        if not isinstance(data_list, list) or len(data_list) < 2:
            print("No data found in the response or unexpected format.")
            return False

        records = data_list[1]
        os.makedirs(DATA_DIR, exist_ok=True)
        
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
        df = pl.read_csv(CSV_FILE)
        df = df.with_columns([
            pl.col("Year").cast(pl.Int32),
            pl.col("Homicide Rate").cast(pl.Float64)
        ])
        
        df.write_parquet(PARQUET_FILE)
        print(f"Data saved as parquet to {PARQUET_FILE}")
        
        db_user = os.getenv("DB_USER", "postgres")
        db_password = os.getenv("PASSWORD", "yeezus9090")
        db_host = os.getenv("DB_HOST", "localhost")
        db_port = os.getenv("PORT", "5432")
        db_name = os.getenv("NAME", "globe")
        
        connection_uri = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
        
        print(f"Loading data into 'homicide' table using ADBC...")
        df.write_database(
            table_name="homicide",
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
