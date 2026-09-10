"""
HypoGuard AI - Python API Client.

A tiny, dependency-free client for the FastAPI prediction backend. Useful for
scripts, testing pipelining or command-line usage.

Example
-------
    from api.client import HypoGuardClient
    c = HypoGuardClient()
    result = c.predict("path/to/photo.jpg")
"""

import os
import json

import requests


class HypoGuardClient:
    """Thin client for the HypoGuard AI prediction API."""

    def __init__(self, base_url="http://localhost:8000/api/v1"):
        self.base_url = base_url.rstrip("/")

    def predict(self, image_path, source="upload"):
        """POST an image file and return the prediction JSON."""
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image not found: {image_path}")
        with open(image_path, "rb") as fh:
            files = {"image": (os.path.basename(image_path), fh)}
            resp = requests.post(
                f"{self.base_url}/predict", files=files, data={"source": source}
            )
        resp.raise_for_status()
        return resp.json()

    def health(self):
        """Check backend health."""
        base = self.base_url.replace("/api/v1", "")
        resp = requests.get(f"{base}/")
        resp.raise_for_status()
        return resp.json()


def pretty_print(result):
    """Human-friendly JSON dump (handy for CLI)."""
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    import sys

    client = HypoGuardClient()
    if len(sys.argv) > 1:
        pretty_print(client.predict(sys.argv[1]))
    else:
        print(json.dumps(client.health(), indent=2))