# Globe Data Engineering Project

A high-performance data engineering and visualization platform that ingests, processes, transforms, and visualizes global socioeconomic indicators from the World Bank API using a modern ELT pipeline and an interactive 3D WebGL globe.

<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#system-architecture">System Architecture</a>
      <ul>
        <li><a href="#data-ingestion-and-processing">Data Ingestion and Processing</a></li>
        <li><a href="#data-transformation">Data Transformation</a></li>
        <li><a href="#graphql-api-layer">GraphQL API Layer</a></li>
        <li><a href="#interactive-visualization">Interactive Visualization</a></li>
      </ul>
    </li>
    <li><a href="#getting-started">Getting Started</a></li>
    <li><a href="#installation-and-setup">Installation and Setup</a></li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
  </ol>
</details>

## About The Project

.globe is a modern, end-to-end spatial data engineering application. The project extracts global homicide rates and sexual violence indicators from the World Bank API, processes them using high-speed column-oriented data structures, transforms them using SQL analytical pipelines, exposes them via a secure GraphQL gateway, and renders the intelligence on a highly interactive WebGL-powered 3D globe.

This application is designed to demonstrate best practices in modern data engineering, utilizing parallelized data loading, change detection, schema management, spatial database extensions, and real-time frontend revalidation.

### Built With

The project uses a hybrid architecture spanning a Python backend, spatial database services, and a React-based frontend.

#### Data Pipeline and Backend

- Python 3.11
- Polars (for high-speed data manipulation using LazyFrames)
- FastAPI (for control endpoints)
- APScheduler (for job scheduling)
- ADBC (Arrow Database Connectivity for ultra-fast database loading)
- DBT (Data Build Tool for database-native analytics and schema modeling)

#### Database and API

- PostgreSQL 15
- PostGIS 3.3 (for spatial database capabilities)
- Hasura GraphQL Engine (for instant high-performance GraphQL generation)
- Docker (for service orchestration)

#### Frontend Dashboard

- Next.js 16 (React 19)
- React-Globe.gl (WebGL 3D globe visualization)
- Three.js (underlying rendering engine)
- TailwindCSS 4 (styling engine)
- Recharts (analytical charting library)
- Zustand (state management)

## System Architecture

The application is structured into four main operational layers.

### Data Ingestion and Processing

The Python backend manages data retrieval and staging:

- **API Ingestion**: The ingestion pipeline fetches raw datasets from the World Bank API for homicide rates (indicator: VC.IHR.PSRC.P5), sexual violence (indicator: SG.VAW.1549.ZS), and sexual violence modeled estimates (indicator: SG.VAW.1549.ME.ZS).
- **SHA-256 Change Detection**: To save bandwidth and computational cycles, the pipeline computes hashes of incoming datasets and compares them against existing local files. Updates only run if differences are detected.
- **Polars Lazy Evaluation**: Processing is performed out-of-core using Polars LazyFrames. It casts column types, handles horizontal joins on Country, ISO3, and Year, and coalesces primary sexual violence indicators with modeled estimates where primary values are missing.
- **Parquet Serialization**: Cleaned, combined tabular data is archived locally as a compressed Parquet file.
- **ADBC Database Load**: Using Arrow Database Connectivity (ADBC) instead of standard row-by-row cursors, Polars writes the combined dataset directly to a staging table (total_statistics) in PostgreSQL, delivering massive database-write throughput.
- **Cache Revalidation**: Once database synchronization completes, the ingestion script fires a POST request to the Next.js frontend webhook to force static page generation revalidation.

### Data Transformation

DBT models and seeds enrich the raw database table:

- **Seeds**: Static mapping seeds translate ISO3 codes to global continents (iso3_to_continent) and latitude/longitude coordinates (iso3_to_coords).
- **Staging Layer**: Raw input databases are prepared in clean, typed SQL staging views.
- **Spines and Cross Joins**: A temporal reporting grid is constructed by cross-joining all unique country identifiers against a continuous series of reporting years (2000 to 2023).
- **Window Functions (Forward Fill)**: Because World Bank indicators are published at irregular intervals, DBT executes Postgres window functions (unbounded preceding, current row partitioning) to project the latest available data forward into missing years.
- **Spatial Processing**: Using the PostGIS library, latitude and longitude mappings are converted into native spatial geometry objects (SRID 4326 for WGS84 coordinates) using ST_MakePoint and ST_SetSRID.
- **Production Marts**: The final enriched record is exposed in the public_marts schema as mart_complete_countries, featuring full spatial coordinates, continent mappings, and historical values.

### GraphQL API Layer

The Hasura GraphQL Engine coordinates data delivery:

- Hasura sits on top of the PostgreSQL instance inside the Docker environment.
- It auto-generates query and subscription APIs for all tables, including the DBT-managed mart_complete_countries.
- This eliminates the need to write and maintain manual CRUD controllers or REST serialization schemas.

### Interactive Visualization

The frontend consumes GraphQL and displays the dashboard:

- Next.js fetches data at build time and updates dynamically on-demand using page revalidation webhooks.
- WebGL globes display interactive country rings, heatmaps, and spatial indicators. Hovering over a country highlights its statistics, trend lines, and comparative continent performance.
- Recharts panels present annual trend lines and historical regressions.

## Getting Started

Follow these instructions to run a local instance of the application.

### Prerequisites

Ensure you have the following software installed:

- Docker and Docker Compose
- Python 3.11 or higher
- Node.js 18 or higher (along with npm)
- (tbh just check "requirements.txt")

## Installation and Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/your-username/globe.git
   cd globe
   ```

2. Configure environment variables. Create a `.env` file in the root directory:

   ```env
   NAME=globe
   PASSWORD=yeezus9090
   DB_PORT=5435
   HASURA_ADMIN_SECRET=myadminsecret
   FRONTEND_URL=http://localhost:3000
   ```

3. Spin up the Postgres database and Hasura engine:

   ```bash
   docker-compose up -d
   ```

4. Install backend dependencies and set up the virtual environment:

   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

   _(Note: Ensure you run the virtual environment activation script appropriate for your operating system shell)._

5. Install DBT dependencies and run migrations:

   ```bash
   cd dbt
   dbt deps
   dbt seed --profiles-dir .
   dbt run --profiles-dir .
   cd ../..
   ```

6. Run the backend ingestion pipeline to load the initial dataset:

   ```bash
   cd backend
   python src/services/worldbank.py
   cd ..
   ```

7. Install frontend dependencies and launch the dev environment:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

8. Open your browser and navigate to `http://localhost:3000` to view the visualization dashboard. The Hasura console is accessible at `http://localhost:8080` using the secret specified in your configuration.

## Usage

- **Interactive Globe**: Rotate the globe by dragging. Hover over countries to view localized homicide and sexual violence data.
- **Trend Analysis**: Click on a region or continent to populate trend lines in the control dashboard.
- **Automatic Updates**: The ingestion scheduler runs in the background. If the World Bank releases updated figures, they are processed, loaded, transformed by DBT, and visualized on the frontend without manual intervention.

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are greatly appreciated.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Contact

Samir Katakamsetty - katakamsettysamir@gmail.com
