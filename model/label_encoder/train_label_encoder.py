"""
HypoGuard AI - Label Encoder.

A scikit-learn-style label encoder that maps between food class names and
integer indices. Persists the mapping to JSON so training, prediction and the
API all agree on the same label space.

The canonical source of truth is model/labels.py (FOOD_CLASSES). This script
also writes a Json class mapping consumed by the FastAPI backend.
"""

import os
import sys
import json

PROJECT_ROOT = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)
sys.path.insert(0, PROJECT_ROOT)

from model.labels import get_index_to_label_mapping  # noqa: E402
from model.labels import get_label_to_index_mapping  # noqa: E402

LABEL_ENCODER_DIR = os.path.join(PROJECT_ROOT, "model", "label_encoder")
LABEL_INDEX_JSON = os.path.join(LABEL_ENCODER_DIR, "label_indices.json")
CLASS_MAPPING_JSON = os.path.join(PROJECT_ROOT, "model", "class_mapping.json")


class LabelEncoder:
    """Mirror of the labels registry with JSON persistence."""

    def __init__(self, label_to_index=None, index_to_label=None):
        self.label_to_index = label_to_index or get_label_to_index_mapping()
        self.index_to_label = index_to_label or get_index_to_label_mapping()
        self.classes_ = sorted(self.label_to_index.keys())

    def transform(self, labels):
        """Map class names -> indices (int)."""
        return [self.label_to_index[label] for label in labels]

    def inverse_transform(self, indices):
        """Map indices (int) -> class names."""
        return [self.index_to_label[i] for i in indices]

    def classes(self):
        return self.classes_

    def save_json(self, path=LABEL_INDEX_JSON):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.label_to_index, f, indent=2, ensure_ascii=False)
        print(f"[OK] Label encoder saved: {path}")

    @classmethod
    def load_json(cls, path=LABEL_INDEX_JSON):
        if not os.path.exists(path):
            return cls()  # fall back to canonical labels
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return cls(label_to_index=data, index_to_label={v: k for k, v in data.items()})


def export_class_mapping():
    """Write the {index: class_name} mapping used by the training pipeline."""
    mapping = get_index_to_label_mapping()
    os.makedirs(os.path.dirname(CLASS_MAPPING_JSON), exist_ok=True)
    with open(CLASS_MAPPING_JSON, "w", encoding="utf-8") as f:
        json.dump({str(k): v for k, v in mapping.items()}, f, indent=2, ensure_ascii=False)
    print(f"[OK] Class mapping exported: {CLASS_MAPPING_JSON}")


if __name__ == "__main__":
    encoder = LabelEncoder()
    encoder.save_json()
    export_class_mapping()
    print(f"[OK] {len(encoder.classes_)} classes encoded.")
