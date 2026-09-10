"""
HypoGuard AI - MobileNetV2 Transfer Learning Trainer.

Trains a food classification model using MobileNetV2 pretrained on ImageNet.

Pipeline
--------
1. Load images from dataset/train and dataset/validation using
   tf.keras.utils.image_dataset_from_directory (folder names = labels).
2. Build a MobileNetV2 base (frozen) + GlobalAveragePooling + Dense head.
3. Train the head, then fine-tune the top layers of the base.
4. Save the model to model/hypo_guard_ai_model.keras and the class mapping.

Usage
-----
    python model/train.py

Requirements
------------
    tensorflow, numpy, scikit-learn  (see backend/requirements.txt)
"""

import os
import sys
import json

import numpy as np
import tensorflow as tf
from sklearn.utils.class_weight import compute_class_weight

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_ROOT)

# ----------------------------------------------------------------------------
# Config
# ----------------------------------------------------------------------------
DATASET_ROOT = os.path.join(PROJECT_ROOT, "dataset")
TRAIN_DIR = os.path.join(DATASET_ROOT, "train")
VALIDATION_DIR = os.path.join(DATASET_ROOT, "validation")
MODEL_DIR = os.path.join(PROJECT_ROOT, "model")

IMG_SIZE = (224, 224)
BATCH_SIZE = 32
EPOCHS_INITIAL = 5        # base frozen
EPOCHS_FINE_TUNE = 8      # base unfrozen
FINE_TUNE_AT = 100        # unfreeze base layers from index 100 onward
LEARNING_RATE = 1e-3
FINE_TUNE_LEARNING_RATE = 1e-5

SEED = 42
tf.random.set_seed(SEED)
np.random.seed(SEED)

MODEL_SAVE_PATH = os.path.join(MODEL_DIR, "hypo_guard_ai_model.keras")
CLASS_MAPPING_PATH = os.path.join(MODEL_DIR, "class_mapping.json")


def _normalize(image, label):
    """Scale pixels from [0,255] to [0,1] for MobileNetV2."""
    image = tf.cast(image, tf.float32) / 255.0
    return image, label


def _augment(image, label):
    """Random geometric augmentation applied only during training."""
    image = tf.image.random_flip_left_right(image)
    image = tf.image.rot90(
    image,
    k=tf.random.uniform(
        shape=[],
        minval=0,
        maxval=4,
        dtype=tf.int32
    )
)
    return image, label


class FoodDataLoader:
    """Load and preprocess the food image dataset from disk."""

    def __init__(self, train_dir, val_dir, img_size=IMG_SIZE, batch_size=BATCH_SIZE):
        self.train_dir = train_dir
        self.val_dir = val_dir
        self.img_size = img_size
        self.batch_size = batch_size
        self.class_names = None

    def load(self, augment=True):
        train_ds = tf.keras.utils.image_dataset_from_directory(
            self.train_dir,
            labels="inferred",
            label_mode="int",
            shuffle=True,
            image_size=self.img_size,
            batch_size=self.batch_size,
            seed=SEED,
        )
        val_ds = tf.keras.utils.image_dataset_from_directory(
            self.val_dir,
            labels="inferred",
            label_mode="int",
            shuffle=False,
            image_size=self.img_size,
            batch_size=self.batch_size,
            seed=SEED,
        )
        self.class_names = train_ds.class_names

        train_ds = train_ds.map(_normalize, num_parallel_calls=tf.data.AUTOTUNE)
        if augment:
            train_ds = train_ds.map(_augment, num_parallel_calls=tf.data.AUTOTUNE)
        train_ds = train_ds.prefetch(tf.data.AUTOTUNE)

        val_ds = val_ds.map(_normalize, num_parallel_calls=tf.data.AUTOTUNE)
        val_ds = val_ds.prefetch(tf.data.AUTOTUNE)
        return train_ds, val_ds

    def compute_class_weights(self, dataset):
        """Balanced class weights to help on imbalanced classes."""
        labels = []
        for _, yb in dataset:
            labels.extend(yb.numpy().tolist())
        if not labels:
            return None
        labels = np.array(labels)
        classes = np.unique(labels)
        weights = compute_class_weight("balanced", classes=classes, y=labels)
        return {int(c): float(w) for c, w in zip(classes, weights)}


def build_model(num_classes_value, unfreeze=False, fine_tune_at=FINE_TUNE_AT):
    """Create a MobileNetV2 transfer-learning model."""
    base_model = tf.keras.applications.MobileNetV2(
        input_shape=(*IMG_SIZE, 3),
        include_top=False,
        weights="imagenet",
    )
    base_model.trainable = False

    inputs = tf.keras.Input(shape=(*IMG_SIZE, 3))
    x = tf.keras.applications.mobilenet_v2.preprocess_input(inputs)
    x = base_model(x, training=False)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.Dropout(0.2)(x)
    outputs = tf.keras.layers.Dense(
        num_classes_value, activation="softmax", name="predictions"
    )(x)
    model = tf.keras.Model(inputs, outputs)

    if unfreeze:
        base_model.trainable = True
        for layer in base_model.layers[:fine_tune_at]:
            layer.trainable = False
        model._base_model = base_model  # keep reference for inspection

    return model


def main():
    print("=" * 60)
    print(" HypoGuard AI - MobileNetV2 Training")
    print("=" * 60)

    loader = FoodDataLoader(TRAIN_DIR, VALIDATION_DIR)
    train_ds, val_ds = loader.load(augment=True)
    print(f"[OK] Loaded {len(loader.class_names)} classes")
    class_weight = loader.compute_class_weights(train_ds)

    # ---- Phase 1: train the head (base frozen) ----
    model = build_model(len(loader.class_names), unfreeze=False)
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=LEARNING_RATE),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    model.summary()
    print("\n=== Phase 1: training head (base frozen) ===")
    model.fit(train_ds, validation_data=val_ds, epochs=EPOCHS_INITIAL,
              class_weight=class_weight, verbose=1)

    # ---- Phase 2: fine-tune top layers of the base ----
    model = build_model(len(loader.class_names), unfreeze=True)
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=FINE_TUNE_LEARNING_RATE),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    print(f"\n=== Phase 2: fine-tuning base (layers >= {FINE_TUNE_AT}) ===")
    model.fit(train_ds, validation_data=val_ds, epochs=EPOCHS_FINE_TUNE,
              class_weight=class_weight, verbose=1)

    # ---- Save model + class mapping ----
    os.makedirs(MODEL_DIR, exist_ok=True)
    model.save(MODEL_SAVE_PATH)
    print(f"\n[OK] Model saved: {MODEL_SAVE_PATH}")

    mapping = {str(i): name for i, name in enumerate(loader.class_names)}
    with open(CLASS_MAPPING_PATH, "w", encoding="utf-8") as f:
        json.dump(mapping, f, indent=2, ensure_ascii=False)
    print(f"[OK] Class mapping saved: {CLASS_MAPPING_PATH}")

    # ---- Evaluation ----
    metrics = model.evaluate(val_ds, verbose=0)
    print("\n=== Validation Results ===")
    print(f"Loss:     {metrics[0]:.4f}")
    print(f"Accuracy: {metrics[1] * 100:.2f}%")


if __name__ == "__main__":
    main()