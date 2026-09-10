# -*- coding: utf-8 -*-
"""
CGM LSTM Prediction Service for HypoGuard AI (PS-I02).
Wraps the trained Experiment 1 LSTM model and fitted feature/target scalers.
Accepts 24 raw continuous glucose readings (past 2 hours at 5-minute intervals)
and generates 30-minute and 60-minute future glucose forecasts with hypoglycemia risk classification.
"""

import os
import pickle
import logging
import numpy as np
import pandas as pd

logger = logging.getLogger("hypoguard.cgm")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "cgm_exp1_lstm_model.keras")
FEAT_SCALER_PATH = os.path.join(BASE_DIR, "cgm_feature_scaler.pkl")
TARG_SCALER_PATH = os.path.join(BASE_DIR, "cgm_target_scaler.pkl")


class CgmPredictor:
    """Singleton predictor for CGM LSTM model."""

    def __init__(
        self,
        model_path=MODEL_PATH,
        feat_scaler_path=FEAT_SCALER_PATH,
        targ_scaler_path=TARG_SCALER_PATH,
    ):
        self.model_path = model_path
        self.feat_scaler_path = feat_scaler_path
        self.targ_scaler_path = targ_scaler_path
        self.model = None
        self.feat_scaler = None
        self.targ_scaler = None

    def _load_artifacts(self):
        if self.model is not None:
            return

        if not (
            os.path.exists(self.model_path)
            and os.path.exists(self.feat_scaler_path)
            and os.path.exists(self.targ_scaler_path)
        ):
            logger.warning("CGM model artifacts not found at %s", self.model_path)
            return

        import tensorflow as tf

        logger.info("Loading CGM LSTM model from %s", self.model_path)
        self.model = tf.keras.models.load_model(self.model_path)

        with open(self.feat_scaler_path, "rb") as f:
            self.feat_scaler = pickle.load(f)
        with open(self.targ_scaler_path, "rb") as f:
            self.targ_scaler = pickle.load(f)
        logger.info("CGM LSTM model and scalers loaded successfully!")

    def predict_24_readings(
        self,
        readings,
        carbs=0.0,
        active_insulin=0.0,
        target_glucose=100.0,
        isf=50.0,
        icr=15.0,
    ):
        """
        Predict 30-min and 60-min glucose from 24 continuous readings (5-min intervals)
        and compute clinical risk plus AI insulin bolus advisory guidance.
        """
        self._load_artifacts()

        carbs = float(carbs) if carbs is not None else 0.0
        active_insulin = float(active_insulin) if active_insulin is not None else 0.0
        target_glucose = (
            float(target_glucose)
            if target_glucose is not None and target_glucose > 0
            else 100.0
        )
        isf = float(isf) if isf is not None and isf > 0 else 50.0
        icr = float(icr) if icr is not None and icr > 0 else 15.0

        if self.model is None:
            # Fallback estimation if model failed to load
            latest = float(readings[-1]) if readings else 110.0
            p30 = round(latest, 1)
            p60 = round(latest, 1)
            return {
                "current_glucose": round(latest, 1),
                "pred_30min": p30,
                "pred_60min": p60,
                "velocity": 0.0,
                "risk_level": "SAFE_IN_RANGE" if latest >= 70 else "CRITICAL_HYPO",
                "risk_status": "✅ SAFE (IN TARGET RANGE)" if latest >= 70 else "🚨 HYPOGLYCEMIA ALERT",
                "risk_message": "CGM model not loaded. Using fallback estimate.",
                "hypo_risk": "low" if latest >= 70 else "high",
                "insulin_action": "MAINTAIN",
                "insulin_status": "🟢 MAINTAIN CURRENT DOSAGE",
                "suggested_bolus": 0.0,
                "correction_dose": 0.0,
                "carb_dose": round(carbs / icr if icr > 0 else 0.0, 2),
                "insulin_message": "CGM model fallback: maintain basal dosage.",
                "source": "fallback",
            }

        readings_arr = np.array(readings, dtype=float)
        if len(readings_arr) != 24:
            raise ValueError(
                f"Expected exactly 24 continuous glucose readings, but received {len(readings_arr)}."
            )

        # 1. Feature Engineering (Velocity, Acceleration, 30-min Rolling Mean & Std)
        df_temp = pd.DataFrame({"Glucose": readings_arr})
        df_temp["Diff1"] = df_temp["Glucose"].diff().fillna(0.0)
        df_temp["Diff2"] = df_temp["Diff1"].diff().fillna(0.0)
        df_temp["RollMean6"] = (
            df_temp["Glucose"].rolling(window=6, min_periods=1).mean()
        )
        df_temp["RollStd6"] = (
            df_temp["Glucose"].rolling(window=6, min_periods=1).std().fillna(0.0)
        )

        feat_matrix = df_temp[
            ["Glucose", "Diff1", "Diff2", "RollMean6", "RollStd6"]
        ].values
        feat_matrix_scaled = self.feat_scaler.transform(feat_matrix)
        X_input = feat_matrix_scaled.reshape(1, 24, 5)

        # 2. Model Prediction
        preds_scaled = self.model.predict(X_input, verbose=0)
        preds = self.targ_scaler.inverse_transform(preds_scaled)[0]

        pred_30min = float(preds[0])
        pred_60min = float(preds[1])
        current_glucose = float(readings_arr[-1])
        velocity = float(df_temp["Diff1"].iloc[-1])

        # 3. Clinical Risk Analysis Logic
        if pred_30min < 70 or pred_60min < 70:
            risk_level = "CRITICAL_HYPO"
            risk_status = "🚨 HYPOGLYCEMIA ALERT"
            risk_message = (
                f"Warning: Predicted glucose drops below 70 mg/dL "
                f"({round(min(pred_30min, pred_60min), 1)} mg/dL). Consume 15g fast-acting carbs."
            )
            hypo_risk = "high"
        elif pred_30min > 180 or pred_60min > 180:
            risk_level = "WARNING_HYPER"
            risk_status = "⚠️ HYPERGLYCEMIA WARNING"
            risk_message = (
                f"Notice: Predicted glucose exceeds 180 mg/dL "
                f"({round(max(pred_30min, pred_60min), 1)} mg/dL). Check insulin guidance."
            )
            hypo_risk = "hyper"
        elif velocity < -3.0:
            risk_level = "RAPID_FALL"
            risk_status = "📉 RAPID DROPPING GLUCOSE"
            risk_message = f"Glucose falling rapidly at {round(velocity, 1)} mg/dL per 5 min. Monitor closely."
            hypo_risk = "moderate"
        else:
            risk_level = "SAFE_IN_RANGE"
            risk_status = "✅ SAFE (IN TARGET RANGE)"
            risk_message = "Glucose is predicted to stay within target safe range (70–180 mg/dL)."
            hypo_risk = "low"

        # 4. AI Insulin Dosage & Action Recommendation Logic
        min_pred = min(current_glucose, pred_30min, pred_60min)
        max_pred = max(current_glucose, pred_30min, pred_60min)

        # Correction dose calculation based on max projected glucose over 60 mins
        if max_pred > target_glucose:
            raw_corr_dose = (max_pred - target_glucose) / isf
        else:
            raw_corr_dose = 0.0

        net_corr_dose = max(0.0, raw_corr_dose - active_insulin)
        carb_dose = carbs / icr if icr > 0 else 0.0

        if min_pred < 80.0 or velocity < -2.5:
            # DECREASE / SUSPEND INSULIN
            insulin_action = "DECREASE"
            insulin_status = "🛑 DECREASE / SUSPEND INSULIN"
            if carb_dose > 0:
                suggested_bolus = round(carb_dose, 2)
                insulin_message = (
                    f"Glucose is low/dropping ({round(min_pred, 1)} mg/dL). "
                    f"Zero correction dose added. Only meal bolus ({suggested_bolus} U) recommended if eating carbs."
                )
            else:
                suggested_bolus = 0.0
                insulin_message = (
                    f"Glucose dropping towards hypoglycemia ({round(min_pred, 1)} mg/dL). "
                    "Suspend or reduce insulin. Consume fast carbs if below 70 mg/dL."
                )
        elif max_pred > 180.0 or carb_dose > 0.1:
            # INCREASE / ADMINISTER INSULIN
            insulin_action = "INCREASE"
            insulin_status = "💉 INCREASE / ADMINISTER INSULIN"
            suggested_bolus = round(net_corr_dose + carb_dose, 2)
            details = []
            if net_corr_dose > 0:
                details.append(f"Correction: +{round(net_corr_dose, 2)} U")
            if carb_dose > 0:
                details.append(f"Carbs: +{round(carb_dose, 2)} U")
            if active_insulin > 0:
                details.append(f"Active IOB Offset: -{round(active_insulin, 2)} U")

            detail_str = f" ({', '.join(details)})" if details else ""
            insulin_message = (
                f"Glucose elevated or spike expected (peak {round(max_pred, 1)} mg/dL). "
                f"Recommended total bolus: {suggested_bolus} U{detail_str}."
            )
        else:
            # MAINTAIN INSULIN
            insulin_action = "MAINTAIN"
            insulin_status = "🟢 MAINTAIN CURRENT DOSAGE"
            suggested_bolus = 0.0
            insulin_message = (
                "Projected glucose is stable within target safe range (80–180 mg/dL). "
                "Maintain current basal dosage; no extra insulin correction needed."
            )

        return {
            "current_glucose": round(current_glucose, 1),
            "pred_30min": round(pred_30min, 1),
            "pred_60min": round(pred_60min, 1),
            "velocity": round(velocity, 2),
            "risk_level": risk_level,
            "risk_status": risk_status,
            "risk_message": risk_message,
            "hypo_risk": hypo_risk,
            "insulin_action": insulin_action,
            "insulin_status": insulin_status,
            "suggested_bolus": suggested_bolus,
            "correction_dose": round(net_corr_dose, 2),
            "carb_dose": round(carb_dose, 2),
            "insulin_message": insulin_message,
            "source": "cgm_lstm_model",
        }
