from fastapi import APIRouter

from app.api.routes import config, keyboard, progressions, session

api_router = APIRouter()
api_router.include_router(config.router, tags=["config"])
api_router.include_router(keyboard.router, tags=["keyboard"])
api_router.include_router(progressions.router, tags=["progressions"])
api_router.include_router(session.router, tags=["session"])
