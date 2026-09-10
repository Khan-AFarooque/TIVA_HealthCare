import { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, X, ImageIcon, Camera } from "lucide-react";
import { validateFile } from "../api/api";

const ACCEPTED = "image/jpeg,image/png,image/webp,image/bmp";

export default function UploadArea({ onImage, onOpenCamera, image }) {
  const [preview, setPreview] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (!image) {
      setPreview(null);
      return;
    }
    if (typeof image === "string") {
      setPreview(image);
    } else if (image instanceof Blob || image instanceof File) {
      const url = URL.createObjectURL(image);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [image]);

  const handleFile = useCallback(
    (file) => {
      setError("");
      try {
        validateFile(file);
        onImage(file);
      } catch (e) {
        setError(e.message);
      }
    },
    [onImage]
  );

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const clearPreview = () => {
    setPreview(null);
    onImage(null);
  };

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {preview ? (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="glass relative overflow-hidden rounded-3xl p-3"
          >
            <img
              src={preview}
              alt="Food preview"
              className="mx-auto max-h-80 w-full rounded-2xl object-cover"
            />
            <button
              onClick={clearPreview}
              className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-brand-ink shadow-lg backdrop-blur transition hover:scale-110 hover:bg-white"
              aria-label="Remove image"
            >
              <X className="h-4 w-4" />
            </button>
            <p className="py-2 text-center text-sm font-medium text-slate-600">
              Image ready — hit <span className="font-semibold text-brand-blue">Analyze</span> below
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`glass group relative flex min-h-[300px] cursor-pointer flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed px-6 py-10 text-center transition-all duration-300 ${
              dragging
                ? "border-brand-blue bg-brand-blue/5 scale-[1.01]"
                : "border-slate-300/70 hover:border-brand-blue/60 hover:bg-white/60"
            }`}
          >
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-blue to-emerald-500 shadow-xl shadow-brand-blue/30"
            >
              <UploadCloud className="h-9 w-9 text-white" />
            </motion.div>

            <div>
              <p className="font-display text-xl font-bold text-brand-ink">
                Drag &amp; drop your food image
              </p>
              <p className="mt-1 text-sm text-slate-500">
                or{" "}
                <span className="font-semibold text-brand-blue underline underline-offset-2">
                  browse from device
                </span>
              </p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500">
                <ImageIcon className="h-3.5 w-3.5" /> JPG · PNG · JPEG · WEBP · BMP
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenCamera();
              }}
              className="mt-2 inline-flex items-center gap-2 rounded-full border border-brand-blue/30 bg-white px-5 py-2.5 text-sm font-semibold text-brand-blue shadow-sm transition hover:scale-105 hover:bg-brand-blue hover:text-white"
            >
              <Camera className="h-4 w-4" /> Use Camera Instead
            </button>

            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600 ring-1 ring-red-200"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
}