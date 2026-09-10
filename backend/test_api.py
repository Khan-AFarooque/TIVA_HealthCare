"""
HypoGuard AI - Backend API smoke tests.

Run from the project root:

    python backend/test_api.py

Requires the fastapi TestClient (httpx) and Pillow/numpy to synthesize a test
image. Does NOT require a trained model or tensorflow.
"""

import os
import sys
import io
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from backend.main import app  # noqa: E402


def make_test_image() -> bytes:
    """Synthesize a textured (non-blurry) RGB image."""
    rng = np.random.default_rng(7)
    arr = rng.normal(128, 45, (400, 400, 3)).clip(0, 255).astype(np.uint8)
    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, "JPEG", quality=92)
    return buf.getvalue()


class ApiSmokeTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_health(self):
        resp = self.client.get("/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["status"], "ok")

    def test_predict_returns_well_formed_response(self):
        # Without a trained model the endpoint must still answer 200 with an
        # "Unknown Food" / model-not-found payload (never a crash).
        resp = self.client.post(
            "/api/v1/predict",
            files={"image": ("plate.jpg", make_test_image(), "image/jpeg")},
            data={"source": "upload"},
        )
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertIn("food_name", body)
        self.assertIn("confidence", body)
        self.assertIn("carbs_g", body)
        self.assertIn("calories_kcal", body)
        self.assertIn("protein_g", body)
        self.assertIn("fat_g", body)
        self.assertIn("recommendation", body)

    def test_rejects_unsupported_format(self):
        resp = self.client.post(
            "/api/v1/predict",
            files={"image": ("anim.gif", b"GIF89a", "image/gif")},
        )
        self.assertEqual(resp.status_code, 400)

    def test_rejects_empty_image(self):
        resp = self.client.post(
            "/api/v1/predict",
            files={"image": ("x.jpg", b"", "image/jpeg")},
        )
        self.assertEqual(resp.status_code, 400)

    def test_nutrition_database_integrity(self):
        import json

        path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                            "nutrition", "indian_foods.json")
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        foods = data["foods"]
        self.assertGreaterEqual(len(foods), 70)
        required = ["name", "category", "serving_size", "weight_g",
                    "carbs_g", "calories_kcal", "protein_g", "fat_g"]
        for food in foods:
            for key in required:
                self.assertIn(key, food)


if __name__ == "__main__":
    unittest.main(verbosity=2)