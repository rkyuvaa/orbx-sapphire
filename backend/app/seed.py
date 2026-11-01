import asyncio
import logging
from app.main import init_db_and_seed

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("orbx.seed")

async def main():
    logger.info("Running database seed script...")
    await init_db_and_seed()
    logger.info("Database seeding complete!")

if __name__ == "__main__":
    asyncio.run(main())
