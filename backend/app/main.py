from fastapi import FastAPI
from app.api.v1.auth import router as auth_router

app = FastAPI(title="Quiz Analytics Platform")

app.include_router(auth_router)