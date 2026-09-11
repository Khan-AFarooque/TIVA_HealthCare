import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { UploadCloud, Camera, Sparkles, LayoutDashboard } from "lucide-react";
import UploadArea from "./UploadArea";
import CameraModal from "./CameraModal";
import ResultCard from "./ResultCard";
import LoadingAnalysis from "./LoadingAnalysis";
import HistoryPanel from "./HistoryPanel";
import { useHistory } from "../hooks/useHistory";
import { predictFoodFromBlob } from "../services/predictor";
import { preloadModel } from "../services/teachable";

function createThumbnail(imageSource) {
  return new Promise((resolve) => {
    if (!imageSource) return resolve(null);
    try {
      let url = "";
      let isBlob = false;
      if (typeof imageSource === "string") {
        url = imageSource;
      } else if (imageSource instanceof Blob) {
        url = URL.createObjectURL(imageSource);
        isBlob = true;
      } else {
        return resolve(null);
      }

      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 110;
          canvas.height = 110;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, 110, 110);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
          if (isBlob) URL.revokeObjectURL(url);
          resolve(dataUrl);
        } catch {
          if (isBlob) URL.revokeObjectURL(url);
          resolve(null);
        }
      };
      img.onerror = () => {
        if (isBlob) URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

export default function FoodAIPage({ onBack, userId }) {
  const [image, setImage] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const { history, addToHistory, clearHistory } = useHistory(userId);

  const handleImage = useCallback((file) => {
    setImage(file);
    setResult(null);
  }, []);

  const handleOpenCamera = useCallback(() => {
    setCameraOpen(true);
  }, []);

  const handleCapture = useCallback(async (blob) => {
    setCameraOpen(false);
    setImage(blob);
    setResult(null);
    setLoading(true);
    try {
      const prediction = await predictFoodFromBlob(blob);
      setResult(prediction);

      // Auto-save to scan history with thumbnail
      if (prediction && prediction.food_name !== "Unknown Food") {
        try {
          const thumb = await createThumbnail(blob);
          addToHistory({
            ...prediction,
            image: thumb,
          });
        } catch {
          addToHistory(prediction);
        }
      }
    } catch (e) {
      console.error("Prediction failed:", e);
      setResult({ food_name: "Unknown Food", confidence: 0, hasNutrition: false, recommendation: "Analysis failed. Please try again." });
    } finally {
      setLoading(false);
    }
  }, [addToHistory]);

  const handleAnalyze = useCallback(async () => {
    if (!image) return;
    setLoading(true);
    try {
      const prediction = await predictFoodFromBlob(image);
      setResult(prediction);

      // Auto-save to scan history with thumbnail
      if (prediction && prediction.food_name !== "Unknown Food") {
        try {
          const thumb = await createThumbnail(image);
          addToHistory({
            ...prediction,
            image: thumb || (typeof image === "string" ? image : null),
          });
        } catch {
          addToHistory(prediction);
        }
      }
    } catch (e) {
      console.error("Prediction failed:", e);
      setResult({ food_name: "Unknown Food", confidence: 0, hasNutrition: false, recommendation: "Analysis failed. Please try again." });
    } finally {
      setLoading(false);
    }
  }, [image, addToHistory]);

  const handleReset = useCallback(() => {
    setImage(null);
    setResult(null);
  }, []);

  const handleSaveMeal = useCallback((entry) => {
    addToHistory(entry);
  }, [addToHistory]);

  const handleCorrection = useCallback(async (corrected) => {
    setResult(corrected);
    if (corrected && corrected.food_name !== "Unknown Food") {
      try {
        const thumb = await createThumbnail(image);
        addToHistory({
          ...corrected,
          image: thumb || (typeof image === "string" ? image : null),
        });
      } catch {
        addToHistory(corrected);
      }
    }
  }, [image, addToHistory]);

  const handleSelectHistory = useCallback((item) => {
    if (!item) return;
    setResult(item);
    if (item.image) {
      setImage(item.image);
    }
  }, []);

  // Preload models on mount
  useEffect(() => {
    preloadModel().catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="glass-strong p-6 rounded-3xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="p-2 rounded-lg text-slate-500 hover:text-brand-blue hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Back to Dashboard"
              >
                <LayoutDashboard className="h-5 w-5" />
              </button>
            )}
            <div>
              <h2 className="font-display text-2xl font-bold text-brand-ink flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-brand-blue" /> Food AI
              </h2>
              <p className="mt-1 text-slate-500">
                AI food recognition with Kaggle 80-class clinical nutrition database.
                Upload an image or use your camera to analyze food instantly.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              AI Ready
            </span>
          </div>
        </div>
      </div>

      {/* Main content: Upload + Camera + Results */}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left: Upload & Results */}
        <div className="space-y-6">
          {/* Upload Area */}
          <UploadArea onImage={handleImage} onOpenCamera={handleOpenCamera} image={image} />

          {/* Analyze Button */}
          {image && !loading && !result && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass p-4 rounded-2xl text-center">
              <button
                id="analyze-food-btn"
                type="button"
                onClick={handleAnalyze}
                className="inline-flex items-center justify-center gap-2.5 w-full py-4 rounded-xl bg-gradient-to-r from-brand-blue to-emerald-500 font-bold text-lg text-white shadow-lg shadow-brand-blue/30 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
              >
                <Sparkles className="h-6 w-6" /> Analyze Food Image
              </button>
            </motion.div>
          )}

          {/* Loading */}
          {loading && <LoadingAnalysis />}

          {/* Result Card */}
          {result && (
            <ResultCard
              result={result}
              onReset={handleReset}
              onSave={handleSaveMeal}
              onCorrection={handleCorrection}
            />
          )}
        </div>

        {/* Right: History Panel */}
        <div className="lg:sticky lg:top-24">
          <HistoryPanel history={history} clearHistory={clearHistory} onSelect={handleSelectHistory} />
        </div>
      </div>

      {/* Camera Modal */}
      <CameraModal open={cameraOpen} onClose={() => setCameraOpen(false)} onCapture={handleCapture} />
    </div>
  );
}