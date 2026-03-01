from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.auth import router as auth_router

app = FastAPI(title="Quiz Analytics Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],         # or ["*"] to allow all
#     allow_credentials=False,        # allow cookies, Authorization headers
#     allow_methods=["*"],           # GET, POST, PUT, DELETE, etc.
#     allow_headers=["*"],           # Accept, Content-Type, Authorization, etc.
# )


app.include_router(auth_router)