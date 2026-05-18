import requests
import csv
import os

# Indicator for intentional homicides (per 100,000 people)
INDICATOR = "VC.IHR.PSRC.P5"
URL = f"https://api.worldbank.org/v2/country/all/indicator/{INDICATOR}?format=json&per_page=20000"
# Path relative to the project root
OUTPUT_DIR = "backend/data"
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "homicide_data.csv")

def fetch_and_save_data():
    print(f"Fetching data from {URL}...")
    try:
        response = requests.get(URL)
        response.raise_for_status()
        
        data_list = response.json()
        
        # The World Bank API returns a list where the first element is metadata
        # and the second element is the actual data.
        if not isinstance(data_list, list) or len(data_list) < 2:
            print("No data found in the response or unexpected format.")
            return

        records = data_list[1]
        
        # Ensure output directory exists
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        
        with open(OUTPUT_FILE, mode='w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            # Write header
            writer.writerow(["Country", "ISO3", "Year", "Homicide Rate"])
            
            count = 0
            for record in records:
                country = record.get("country", {}).get("value")
                iso3 = record.get("countryiso3code")
                year = record.get("date")
                value = record.get("value")
                
                # Only write rows that have a value
                if value is not None:
                    writer.writerow([country, iso3, year, value])
                    count += 1
                    
        print(f"Successfully saved {count} homicide data records to {OUTPUT_FILE}")
    except requests.exceptions.RequestException as e:
        print(f"Error fetching data: {e}")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    fetch_and_save_data()
