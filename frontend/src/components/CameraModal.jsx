import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, CameraOff, X, Scan, AlertTriangle } from "lucide-react";

export default function CameraModal({ open, onClose, onCapture }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let active = true;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (e) {
        setError(
          "Camera access denied or unavailable. Please allow camera permission or use Upload instead."
        );
      }
    }
    start();
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(blob);
      },
      "image/jpeg",
      0.9
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-ink/80 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.85, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.85, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-strong w-full max-w-lg overflow-hidden rounded-3xl"
          >
            <div className="flex items-center justify-between border-b border-white/50 px-5 py-4">
              <div className="flex items-center gap-2 font-display font-bold text-brand-ink">
                <Camera className="h-5 w-5 text-brand-blue" /> Capture Food
              </div>
              <button onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative bg-black">
              {!error ? (
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="aspect-[4/3] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center p-6 text-center text-sm text-white/80">
                  <AlertTriangle className="mr-2 h-5 w-5" /> {error}
                </div>
              )}
              {!error && (
                <span className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> LIVE
                </span>
              )}
            </div>

            <div className="flex items-center justify-center gap-4 px-5 py-5">
              {!error && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={capture}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-blue to-emerald-500 px-7 py-3 font-semibold text-white shadow-lg shadow-brand-blue/30"
                >
                  <Scan className="h-4 w-4" /> Capture &amp; Analyze
                </motion.button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}