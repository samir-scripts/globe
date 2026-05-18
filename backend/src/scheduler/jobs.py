from apscheduler.schedulers.asyncio import AsyncIOScheduler
from src.services.worldbank import run_pipeline
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create scheduler instance
scheduler = AsyncIOScheduler()

async def scheduled_pipeline_job():
    """Wrapper function for the scheduled pipeline execution."""
    logger.info("Starting scheduled monthly pipeline job...")
    result = run_pipeline()
    logger.info(f"Pipeline job completed: {result}")

def setup_scheduler():
    """Configure the scheduler with the monthly job."""
    # Run on the 1st day of every month at 00:00
    scheduler.add_job(
        scheduled_pipeline_job,
        "cron",
        day=1,
        hour=0,
        minute=0,
        id="monthly_worldbank_update",
        replace_existing=True
    )
    logger.info("Scheduler configured: Monthly job added for the 1st of every month.")
