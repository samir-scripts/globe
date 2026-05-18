from fastapi import APIRouter, BackgroundTasks
from src.services.worldbank import run_pipeline
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "globe-backend"}

@router.post("/pipeline/trigger")
async def trigger_pipeline(background_tasks: BackgroundTasks):
    """
    Manually trigger the homicide data pipeline.
    Runs as a background task to avoid blocking the API response.
    """
    logger.info("Manual pipeline trigger received.")
    
    def run_and_log():
        result = run_pipeline()
        logger.info(f"Manual pipeline execution result: {result}")

    background_tasks.add_task(run_and_log)
    return {"message": "Pipeline execution started in the background."}
