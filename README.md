# 🍛 HypoGuard AI

**AI-Powered Indian Food Recognition & Carbohydrate Estimation System for Diabetic Care**

HypoGuard AI lets diabetic users **upload a photo** or **capture a food image with their camera** and instantly get:

- Detected **Food Name** with a **Confidence Score**
- **Category** & **Serving Size**
- Estimated **Carbohydrates**, **Calories**, **Protein** and **Fat**
- A short **diabetic-safe recommendation**

Built as a production-quality, hackathon-ready monorepo with a **React** frontend, a **FastAPI** backend and a real **TensorFlow / MobileNetV2** transfer-learning image classifier (78 Indian food classes).

---

## 📋 PS-I02 Official Requirement Coverage

| Requirement Item | Implementation Status | Component / Architecture |
|---|---|---|
| **Glucose input** | ✅ Implemented | Manual blood glucose entry & continuous CGM ingestion |
| **CGM CSV import** | ✅ Implemented | Dexcom, FreeStyle Libre, and Generic CSV parser with time-series validation |
| **Insulin dose logging** | ✅ Implemented | History log tracking date/time, insulin type, medication brand, and units |
| **Meal logging** | ✅ Implemented | Real-time Food AI image recognition + manual carbohydrate logging |
| **Indian food recognition** | ✅ Implemented | MobileNetV2 (78 classes) + in-browser Teachable Machine (50 classes) |
| **Carbohydrate estimation** | ✅ Implemented | 78-item curated Indian food nutritional database (`indian_foods.json`) |
| **30/60 min glucose forecasting** | ✅ Implemented | Trained LSTM neural network (`cgm_exp1_lstm_model.keras`) with 5 features |
| **Hypoglycemia risk indication** | ✅ Implemented | Real-time predictive alerts for forecasted values < 70 mg/dL |

---

## ✨ Features

| Area | Details |
| --- | --- |
| 📈 CGM CSV Import | Support for Dexcom, Libre & Generic continuous glucose CSVs |
| 🔮 LSTM Forecasting | 30-min & 60-min predictive glucose curves with Hypo Risk indicators |
| 🖼️ Image Upload | Drag & drop + file browser (JPG / PNG / JPEG / WEBP / BMP) |
| 📷 Live Camera | `getUserMedia` capture → instant prediction |
| 🧠 Real AI | MobileNetV2 transfer learning + LSTM time-series forecasting |
| 📊 Nutrition | 78-item curated Indian food database with realistic macro values |
| ⚕️ Diabetic UX | Carb-aware recommendations, bolus calculator & caregiver alerts |
| 🕘 History | Previous scans & insulin doses persisted in browser `localStorage` |
| 🛡️ Error Handling | Blur detection, unsupported-format, and physiological range guards |
| 🎨 UI | Blue + white + emerald glassmorphism, Framer Motion animations |

---

## 🧱 Project Structure

```
├── frontend/                 # React 18 + Vite + Tailwind + Framer Motion
│   ├── src/
│   │   ├── api/api.js        # API client + validation
│   │   ├── components/       # UploadArea, CameraModal, ResultCard, History…
│   │   ├── hooks/useHistory.js
│   │   └── App.jsx
├── backend/
│   ├── main.py               # FastAPI app + CORS
│   ├── routes/predict.py     # POST /api/v1/predict
│   ├── test_api.py           # Smoke tests
│   └── requirements.txt
├── model/
│   ├── labels.py             # Canonical 78-class label registry
│   ├── train.py              # MobileNetV2 training pipeline
│   ├── predict.py            # Inference + nutrition mapping
│   ├── preprocessing.py      # Load / resize / blur & size checks
│   ├── dataset_prep.py       # Dataset folder skeleton + audit
│   ├── download_dataset.py   # (Optional) image fetch helper
│   └── label_encoder/        # Label index JSON generator
├── nutrition/
│   └── indian_foods.json     # 78 foods × full nutrition records
├── dataset/
│   ├── train/<Food>/*.jpg    # Training images (you supply)
│   └── validation/<Food>/*.jpg
├── api/
│   └── client.py             # Python API client for scripting/testing
└── assets/                   # Branding / demo assets
```

---

## 🚀 Installation

### 1. Backend (Python 3.10–3.12 recommended)

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate    # macOS / Linux
pip install -r requirements.txt
```

> ⚠️ TensorFlow currently supports Python **3.9–3.12**. Python 3.13/3.14 is not yet supported.

### 2. Frontend (Node 18+)

```bash
cd frontend
npm install
```

---

## 🗂️ How to Prepare the Dataset

The model expects one folder per food class:

```
dataset/
├── train/
│   ├── Chapati/        *.jpg
│   ├── White Rice/     *.jpg
│   └── …               (78 classes)
└── validation/
    ├── Chapati/        *.jpg
    └── …
```

Generate the skeleton and see how many images you still need:

```bash
python model/dataset_prep.py
```

**Recommended:** 50–100 images per class (train), ~20% for validation. Manually curate to remove wrong/duplicate images — dataset quality is the #1 accuracy lever for a hackathon model.

*(Optional) auto-download a starting set:*

```bash
setx GOOGLE_API_KEY your_key
setx GOOGLE_CX your_search_engine_id
python model/download_dataset.py --images 15 --split 0.2
```

---

## 🧠 How to Train

```bash
python model/train.py
```

The trainer:

1. Loads `dataset/train` & `dataset/validation` with `image_dataset_from_directory`.
2. Uses **MobileNetV2** pretrained on ImageNet (frozen) + `GlobalAveragePooling2D` + Dropout + softmax head.
3. **Phase 1** trains the head; **Phase 2** fine-tunes base layers from index 100.
4. Applies random flip / rotation / zoom augmentation and balanced class weights.
5. Saves `model/hypo_guard_ai_model.keras` and `model/class_mapping.json`.

Export the canonical label index used by the API:

```bash
python model/label_encoder/train_label_encoder.py
```

---

## ▶️ How to Run

### Backend

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
# or: python backend/main.py
```

- Interactive API docs → http://localhost:8000/docs
- Health check → http://localhost:8000/

### Frontend

```bash
cd frontend
npm run dev
```

Open → http://localhost:5173

The Vite dev server proxies `/api` to `http://localhost:8000` so no CORS config is needed locally.

---

## 📡 API Reference

### `POST /api/v1/predict`

**Body (multipart/form-data)**

| Field | Type | Description |
| --- | --- | --- |
| `image` | file | The food photo (JPG/PNG/JPEG/WEBP/BMP, max 10 MB) |
| `source` | string | `upload` or `camera` |

**Response (200)**

```json
{
  "food_name": "Jeera Rice",
  "confidence": 0.87,
  "category": "Rice",
  "serving_size": "1 bowl (150g)",
  "carbs_g": 45.0,
  "calories_kcal": 220.0,
  "protein_g": 4.5,
  "fat_g": 3.0,
  "weight_g": 150.0,
  "recommendation": "Ghee adds calories. Keep portion moderate and combine with dal.",
  "source": "upload"
}
```

If the top class scores **below 60%**, the API returns `"food_name": "Unknown Food"` with a guidance message. Blurry or too-small images get explicit error messaging.

---

## ✅ How to Test

### Backend smoke tests (no model / no GPU required)

```bash
python backend/test_api.py
```

Covers: health check, well-formed prediction payload, unsupported format (400), empty file (400), and nutrition-database integrity (≥70 foods, all required fields).

### Frontend build check

```bash
cd frontend && npm run build
```

### End-to-end prediction via Python client

```bash
python api/client.py path/to/photo.jpg
```

---

## 🍛 Nutrition Database

`nutrition/indian_foods.json` contains **78 Indian foods** across 10 categories — Breads, Rice, Dal, Sabzi, South Indian, Snacks, Fruits, Vegetables, Dairy and Others — each with realistic **serving size, weight, carbs, calories, protein, fat, glycemic index** and a diabetic-safe recommendation.

```bash
python -c "import json;d=json.load(open('nutrition/indian_foods.json'));print(len(d['foods']),'foods')"
```

---

## 🛡️ Error Handling Matrix

| Condition | Behaviour |
| --- | --- |
| Unsupported file type | `400 Unsupported image type…` |
| Empty / corrupt file | `400 No image provided…` |
| Oversized file (>10 MB) | `413 Image too large…` |
| Blurry image | `"Unknown Food"` + *"Please upload a clearer image"* |
| Low confidence (<60%) | `"Unknown Food"` + top-3 candidates shown |
| Model not trained yet | `"Unknown Food"` + *"Run `python model/train.py`"* |

---

## 🧰 Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS, Framer Motion, Lucide React
- **Backend:** Python, FastAPI, Uvicorn
- **ML:** TensorFlow, Keras, MobileNetV2, OpenCV, NumPy, scikit-learn
- **Data:** Pandas, JSON

---

## 📝 License

Built for the healthcare hackathon. Educational use only — estimates are **not a medical diagnosis**. Always consult a certified diabetes educator or physician.
