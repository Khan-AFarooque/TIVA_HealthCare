"""
HypoGuard AI - FastAPI application entrypoint.

Run with:
    uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

Or:
    python backend/main.py
"""

import os
import sys
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_ROOT)

from fastapi.staticfiles import StaticFiles
from backend.routes.predict import (
    router as predict_router,
    predict_cgm,
    get_cgm_presets,
    detect_cgm_image,
    CgmPredictionRequest,
    ImagePresetRequest,
)  # noqa: E402
from backend.routes.alerts import router as alerts_router  # noqa: E402
from fastapi import UploadFile, File
from typing import Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("hypoguard")

app = FastAPI(
    title="HypoGuard AI",
    description=(
        "AI-powered Indian Food Recognition & Carbohydrate Estimation for diabetic care. "
        "Detects food from images and returns carbs, calories, protein, fat and a "
        "personalised recommendation."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Allow the React dev server and any production origin to call the API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(predict_router, prefix="/api/v1", tags=["prediction"])
app.include_router(alerts_router, prefix="/api/alerts", tags=["alerts"])

# Serve static directory (images etc.)
static_dir = os.path.join(PROJECT_ROOT, "frontend", "public", "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Root /api aliases for GlucoAI Demo Module endpoints
@app.post("/api/predict", tags=["glucoai"])
async def predict_glucose_api(request: CgmPredictionRequest):
    return await predict_cgm(request)

@app.get("/api/presets", tags=["glucoai"])
def presets_api():
    return get_cgm_presets()

@app.post("/api/detect-image", tags=["glucoai"])
async def detect_image_api(payload: Optional[ImagePresetRequest] = None, file: Optional[UploadFile] = File(None)):
    return await detect_cgm_image(payload=payload, file=file)


@app.get("/", tags=["health"])
def health_check():
    """Health check endpoint used by the frontend to verify connectivity."""
    return {
        "status": "ok",
        "service": "HypoGuard AI Backend",
        "version": "1.0.0",
        "model_loaded": _model_ready(),
    }


def _model_ready():
    model_path = os.path.join(PROJECT_ROOT, "model", "hypo_guard_ai_model.keras")
    return os.path.exists(model_path)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
