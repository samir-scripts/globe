from fastapi import FastAPI
from contextlib import asynccontextmanager
from src.api.routes import router as api_router
from src.scheduler.jobs import scheduler, setup_scheduler
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan manager to handle startup and shutdown events.
    Starts the APScheduler on startup and shuts it down on exit.
    """
    logger.info("Starting up FastAPI application...")
    
    # 1. Setup and start the scheduler
    setup_scheduler()
    scheduler.start()
    logger.info("Scheduler started.")
    
    yield
    
    # 2. Shutdown the scheduler
    logger.info("Shutting down application...")
    scheduler.shutdown()
    logger.info("Scheduler shut down.")

# Initialize FastAPI app
app = FastAPI(
    title="Globe Backend",
    description="Backend for the Globe Data Engineering project, handling World Bank data ingestion and scheduling.",
    version="0.1.0",
    lifespan=lifespan
)

# Include API routes
app.include_router(api_router, prefix="/api")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
