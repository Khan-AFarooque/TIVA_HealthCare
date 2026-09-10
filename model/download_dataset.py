"""
HypoGuard AI - Optional dataset image downloader.

Fetches a few reference images per class from the open web use Google
Custom Search Image API so you can bootstrap a training set quickly.

Requirements
------------
    pip install requests
    A Google Custom Search API key + Search Engine (CX) ID.

Usage
-----
    setx GOOGLE_API_KEY your_key
    setx GOOGLE_CX your_cx_id
    python model/download_dataset.py --per-class 20 --split 0.2

Notes
-----
- Images land in dataset/train/<Food>/.
- --split moves a fraction into dataset/validation/<Food>/.
- Covers only the minimum number of images requested; quality control is left
  to the human user (hackathon datasets are small and hand-curated).
"""

import os
import sys
import time
import shutil
import random
import argparse

import requests

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_ROOT)

from model.labels import FOOD_CLASSES  # noqa: E402
from model.dataset_prep import sanitize_folder_name as sanitize  # noqa: E402

TRAIN_DIR = os.path.join(PROJECT_ROOT, "dataset", "train")
VALIDATION_DIR = os.path.join(PROJECT_ROOT, "dataset", "validation")
GOOGLE_ENDPOINT = "https://www.googleapis.com/customsearch/v1"

UA = {"User-Agent": "HypoGuardAI/1.0"}


def fetch_image_urls(api_key, cx, query, num=10, start=1):
    """Return list of image URLs from the Google Custom Search API."""
    params = {
        "key": api_key,
        "cx": cx,
        "q": query,
        "searchType": "image",
        "num": min(num, 10),
        "start": start,
    }
    resp = requests.get(GOOGLE_ENDPOINT, params=params, timeout=30)
    resp.raise_for_status()
    items = resp.json().get("items", [])
    return [it["link"] for it in items]


def download(url, dest):
    """Download an image to dest if it looks like a real image (>1KB)."""
    req = requests.get(url, headers=UA, timeout=30, stream=True)
    req.raise_for_status()
    content = req.content
    if len(content) < 1000:
        return False
    with open(dest, "wb") as fh:
        fh.write(content)
    return True


def split_validation(split):
    """Move an fraction of train images into the validation folder."""
    for label in FOOD_CLASSES:
        safe = sanitize(label)
        src = os.path.join(TRAIN_DIR, safe)
        dst = os.path.join(VALIDATION_DIR, safe)
        os.makedirs(dst, exist_ok=True)
        files = [
            f
            for f in os.listdir(src)
            if f.lower().endswith((".jpg", ".jpeg", ".png"))
        ]
        random.shuffle(files)
        n = int(len(files) * split)
        for f in files[:n]:
            shutil.move(os.path.join(src, f), os.path.join(dst, f))
    print("[ok] validation split created.")


def main():
    parser = argparse.ArgumentParser(description="Download food images per class.")
    parser.add_argument("--images", type=int, default=15, help="Images per class.")
    parser.add_argument("--start", type=int, default=1, help="Pagination start.")
    parser.add_argument("--split", type=float, default=0.0,
                        help="Fraction to move into validation (0..1).")
    args = parser.parse_args()

    api_key = os.environ.get("GOOGLE_API_KEY")
    cx = os.environ.get("GOOGLE_CX")
    if not api_key or not cx:
        print("Set GOOGLE_API_KEY and GOOGLE_CX first, or populate the dataset manually.")
        sys.exit(1)

    for label in FOOD_CLASSES:
        safe = sanitize(label)
        os.makedirs(os.path.join(TRAIN_DIR, safe), exist_ok=True)
        downloaded = 0
        print(f"\n[{label}]")
        try:
            urls = fetch_image_urls(api_key, cx, f"{label} indian food plate",
                                    num=10, start=args.start)
        except Exception as exc:  # noqa: BLE001
            print(f"  skip: {exc}")
            continue
        for url in urls:
            if downloaded >= args.images:
                break
            dest = os.path.join(TRAIN_DIR, safe, f"{downloaded:03d}.jpg")
            try:
                if download(url, dest):
                    downloaded += 1
                    print(f"  {downloaded}.jpg")
                time.sleep(0.4)
            except Exception:  # noqa: BLE001
                continue
        print(f"  downloaded {downloaded}/{args.images}")

    if args.split > 0:
        split_validation(args.split)


if __name__ == "__main__":
    main()