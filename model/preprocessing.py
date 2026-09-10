"""
HypoGuard AI - Image Quality & Preprocessing utilities.

Provides helpers used before/after inference:
- contrast-based blur detection (Laplacian variance)
- validation of supported image formats / dimension sanity
- standardized loading + resize + normalization to feed MobileNetV2
"""

import os
import io

import cv2
import numpy as np
from PIL import Image, UnidentifiedImageError

# Thresholds (tuned for food photo pipeline - soft foods have low edge variance)
BLUR_VARIANCE_THRESHOLD = 5.0
MIN_IMAGE_DIMENSION = 50
SUPPORTED_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp", ".bmp")


def is_supported_filename(filename):
    """True if file extension is in our supported set."""
    _, ext = os.path.splitext(filename or "")
    return ext.lower() in SUPPORTED_EXTENSIONS


def load_image_bytes(image_bytes):
    """Decode raw bytes into a numpy RGB array.

    Raises ValueError for unsupported/corrupt images.
    """
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except (UnidentifiedImageError, OSError) as e:
        raise ValueError("Unsupported image format or corrupt file.") from e
    return np.array(img)


def check_min_size(image_array, min_dim=MIN_IMAGE_DIMENSION):
    """Reject absurdly tiny/downscaled images."""
    h, w = image_array.shape[:2]
    if min(h, w) < min_dim:
        raise ValueError("Image is too small. Please upload a clearer, larger image.")


def detect_blur(image_array, threshold=BLUR_VARIANCE_THRESHOLD):
    """Return (is_blurry: bool, variance: float) using the Laplacian.

    A low variance of the Laplacian indicates low texture = blur.
    """
    gray = cv2.cvtColor(image_array, cv2.COLOR_RGB2GRAY)
    variance = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    return variance < threshold, round(variance, 2)


def check_quality(image_array):
    """Raise ValueError for images that are too small; return None otherwise."""
    check_min_size(image_array)


def preprocess_for_model(image_array, img_size=(224, 224)):
    """Resize + normalize to [0,1] for MobileNetV2.

    Returns a float32 array with shape (1, 224, 224, 3).
    """
    resized = cv2.resize(image_array, img_size, interpolation=cv2.INTER_AREA)
    normalized = resized.astype(np.float32) / 255.0
    return np.expand_dims(normalized, axis=0)