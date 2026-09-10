# -*- coding: utf-8 -*-
"""
Inference Script for Continuous Glucose Monitoring (CGM) Prediction Model (Exp 1).
Loads trained model (.keras), feature scaler (.pkl), and target scaler (.pkl).
Accepts 24 raw glucose readings (5-minute intervals = past 2 hours) and outputs
predicted 30-minute and 60-minute future glucose values (mg/dL).
"""

import os
import pickle
import numpy as np
import pandas as pd
import tensorflow as tf

def load_cgm_predictor(
    model_path="cgm_exp1_lstm_model.keras",
    feat_scaler_path="cgm_feature_scaler.pkl",
    targ_scaler_path="cgm_target_scaler.pkl"
):
    """Loads the trained Keras LSTM model and fitted feature/target scalers."""
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model file '{model_path}' not found!")
    if not os.path.exists(feat_scaler_path):
        raise FileNotFoundError(f"Feature scaler file '{feat_scaler_path}' not found!")
    if not os.path.exists(targ_scaler_path):
        raise FileNotFoundError(f"Target scaler file '{targ_scaler_path}' not found!")

    model = tf.keras.models.load_model(model_path)
    with open(feat_scaler_path, "rb") as f:
        feat_scaler = pickle.load(f)
    with open(targ_scaler_path, "rb") as f:
        targ_scaler = pickle.load(f)

    return model, feat_scaler, targ_scaler

def predict_future_glucose(raw_24_readings, model, feat_scaler, targ_scaler):
    """
    Given 24 historical glucose readings (5-min intervals over past 2 hours),
    calculates features, scales input, and outputs 30-min and 60-min forecasts.
    
    Parameters:
    -----------
    raw_24_readings : list or np.ndarray of shape (24,)
        24 continuous glucose readings (mg/dL) in chronological order.
    model : tf.keras.Model
        Loaded Experiment 1 LSTM model.
    feat_scaler : StandardScaler
        Fitted feature scaler (5 features).
    targ_scaler : StandardScaler
        Fitted target scaler (2 targets).
        
    Returns:
    --------
    dict : {"pred_30min": float, "pred_60min": float}
    """
    raw_24_readings = np.array(raw_24_readings, dtype=float)
    if len(raw_24_readings) != 24:
        raise ValueError(f"Expected exactly 24 glucose readings, but got {len(raw_24_readings)}.")

    # 1. Feature Engineering (Velocity, Acceleration, 30-min Rolling Mean & Std)
    df_temp = pd.DataFrame({"Glucose": raw_24_readings})
    df_temp["Diff1"] = df_temp["Glucose"].diff().fillna(0.0)
    df_temp["Diff2"] = df_temp["Diff1"].diff().fillna(0.0)
    df_temp["RollMean6"] = df_temp["Glucose"].rolling(window=6, min_periods=1).mean()
    df_temp["RollStd6"] = df_temp["Glucose"].rolling(window=6, min_periods=1).std().fillna(0.0)

    # Extract 5 features matrix of shape (24, 5)
    feat_matrix = df_temp[["Glucose", "Diff1", "Diff2", "RollMean6", "RollStd6"]].values

    # 2. Scale Features
    feat_matrix_scaled = feat_scaler.transform(feat_matrix)

    # 3. Reshape for LSTM input: (batch_size=1, sequence_length=24, num_features=5)
    X_input = feat_matrix_scaled.reshape(1, 24, 5)

    # 4. Model Prediction & Inverse Scaling
    preds_scaled = model.predict(X_input, verbose=0)
    preds = targ_scaler.inverse_transform(preds_scaled)[0]

    return {
        "pred_30min": round(float(preds[0]), 2),
        "pred_60min": round(float(preds[1]), 2)
    }

# Example Usage Demonstration
if __name__ == "__main__":
    print("Loading CGM Model and Scalers...")
    model, feat_scaler, targ_scaler = load_cgm_predictor()
    print("Model and Scalers loaded successfully!\n")

    # Example: 24 sample glucose readings over past 2 hours (e.g. rising trend)
    sample_readings = [
        110, 112, 115, 118, 122, 126,
        130, 135, 141, 146, 152, 157,
        162, 166, 170, 173, 175, 178,
        180, 182, 183, 185, 186, 187
    ]

    print("Input 24 Readings (past 2 hours, 5-min intervals):")
    print(sample_readings)

    prediction = predict_future_glucose(sample_readings, model, feat_scaler, targ_scaler)

    print("\n-------------------------------------------")
    print(f"Predicted Glucose (t + 30 min): {prediction['pred_30min']} mg/dL")
    print(f"Predicted Glucose (t + 60 min): {prediction['pred_60min']} mg/dL")
    print("-------------------------------------------")
