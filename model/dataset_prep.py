"""
HypoGuard AI - Dataset preparation helpers.

Given the nutrition database, this script creates the folder skeleton
under dataset/ and optionally scrapes/documents which images to place
under each class folder.

NOTE: Images are NOT downloaded here. The user (or a provided scraper)
places real photos under:

    dataset/train/<Food Name>/*.jpg
    dataset/validation/<Food Name>/*.jpg

This script validates the structure and prints a report so you know how
many images per class you still need for a balanced dataset.
"""

import os
import sys
import json

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_ROOT)

from model.labels import FOOD_CLASSES  # noqa: E402

DATASET_ROOT = os.path.join(PROJECT_ROOT, "dataset")
TRAIN_DIR = os.path.join(DATASET_ROOT, "train")
VALIDATION_DIR = os.path.join(DATASET_ROOT, "validation")


def ensure_folder_skeleton():
    """Create the class subfolders for train and validation."""
    os.makedirs(TRAIN_DIR, exist_ok=True)
    os.makedirs(VALIDATION_DIR, exist_ok=True)
    for label in FOOD_CLASSES:
        safe = sanitize_folder_name(label)
        os.makedirs(os.path.join(TRAIN_DIR, safe), exist_ok=True)
        os.makedirs(os.path.join(VALIDATION_DIR, safe), exist_ok=True)
    print(f"[OK] Skeleton ready under {DATASET_ROOT}")


def sanitize_folder_name(label):
    """Windows-safe folder name (no forward slashes, no invalid chars)."""
    invalid = '<>:"/\\|?*'
    safe = "".join("_" if c in invalid else c for c in label)
    return safe.strip().rstrip(".")


def count_images():
    """Count number of images per class in train and validation."""
    report = {}
    total_train = total_val = 0
    for label in FOOD_CLASSES:
        safe = sanitize_folder_name(label)
        train_path = os.path.join(TRAIN_DIR, safe)
        val_path = os.path.join(VALIDATION_DIR, safe)
        n_train = count_files(train_path)
        n_val = count_files(val_path)
        total_train += n_train
        total_val += n_val
        report[label] = {"train": n_train, "validation": n_val}
    return report, total_train, total_val


def count_files(folder):
    if not os.path.isdir(folder):
        return 0
    exts = (".jpg", ".jpeg", ".png", ".webp", ".bmp")
    return sum(1 for f in os.listdir(folder) if f.lower().endswith(exts))


def print_report(report, total_train, total_val):
    print(f"\n{'Food':<24}{'Train':>8}{'Val':>8}")
    print("-" * 40)
    for label, counts in report.items():
        flag = "  <-- needs images" if counts["train"] < 10 else ""
        print(f"{label:<24}{counts['train']:>8}{counts['validation']:>8}{flag}")
    print("-" * 40)
    print(f"TOTAL{'':<19}{total_train:>8}{total_val:>8}")
    print("\nRecommended minimum: 50+ images per class (train) for good accuracy.")


def build_nutrition_lookup():
    """Sanity check: every model label exists in the nutrition database."""
    db_path = os.path.join(PROJECT_ROOT, "nutrition", "indian_foods.json")
    with open(db_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    names = {f["name"] for f in data["foods"]}
    missing = [label for label in FOOD_CLASSES if label not in names]
    if missing:
        print(f"[WARN] Labels missing from nutrition DB: {missing}")
    else:
        print("[OK] All model labels have matching nutrition data.")


if __name__ == "__main__":
    ensure_folder_skeleton()
    report, tt, tv = count_images()
    print_report(report, tt, tv)
    build_nutrition_lookup()
