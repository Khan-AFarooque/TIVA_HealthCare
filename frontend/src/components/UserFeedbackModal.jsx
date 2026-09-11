import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  X,
  Star,
  CheckCircle2,
  Sparkles,
  Send,
  History,
  ThumbsUp,
  AlertCircle,
} from "lucide-react";

const CATEGORIES = [
  { id: "food_ai", label: "🥗 Food AI & Carbs", desc: "Food image recognition and nutrition accuracy" },
  { id: "glucose_pred", label: "📈 Glucose Prediction", desc: "CGM 30m & 60m trend forecasting" },
  { id: "insulin_calc", label: "💉 Insulin Calculator", desc: "Bolus calculations and clinical logging" },
  { id: "performance", label: "⚡ Speed & Experience", desc: "App performance, reload speed, and UI" },
  { id: "general", label: "💡 Feature Request / General", desc: "General suggestions and comments" },
];

const QUICK_COMMENTS = [
  "Predictions are accurate and helpful! 👌",
  "Food AI recognition works fast! 🥗",
  "Very smooth glucose forecast graph 📈",
  "Helps prevent hypoglycemia risk 🛡️",
];

export default function UserFeedbackModal({ isOpen, onClose, userId }) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [category, setCategory] = useState("food_ai");
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [savedLogs, setSavedLogs] = useState([]);

  // Load past feedback
  useEffect(() => {
    try {
      const existing = JSON.parse(localStorage.getItem("tiva_user_feedback") || "[]");
      setSavedLogs(existing);
    } catch {
      setSavedLogs([]);
    }
  }, [isOpen, submitted]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!comment.trim() && rating === 0) return;

    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      userId: userId || "guest",
      category,
      categoryLabel: CATEGORIES.find((c) => c.id === category)?.label || category,
      rating: rating || 5,
      comment: comment.trim() || "Positive experience confirmed.",
      submittedAt: new Date().toISOString(),
    };

    try {
      const existing = JSON.parse(localStorage.getItem("tiva_user_feedback") || "[]");
      const updated = [entry, ...existing].slice(0, 50);
      localStorage.setItem("tiva_user_feedback", JSON.stringify(updated));
      setSavedLogs(updated);
      window.dispatchEvent(new CustomEvent("tiva-feedback-submitted", { detail: entry }));
    } catch (err) {
      console.warn("Feedback save error:", err);
    }

    setSubmitted(true);
  };

  const handleReset = () => {
    setRating(5);
    setCategory("food_ai");
    setComment("");
    setSubmitted(false);
    setShowHistory(false);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 sm:p-7 space-y-5"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-slate-800">
                  User Feedback & Suggestions
                </h3>
                <p className="text-xs text-slate-400">
                  Help improve TIVA AI accuracy and user experience
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Success Screen */}
          {submitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-8 text-center space-y-4"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-slate-800">
                  Thank You for Your Feedback!
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  Your feedback has been successfully recorded and helps refine our clinical AI algorithms.
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Submit Another
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </motion.div>
          ) : showHistory ? (
            /* History Screen */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Past Submitted Feedback ({savedLogs.length})
                </span>
                <button
                  type="button"
                  onClick={() => setShowHistory(false)}
                  className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
                >
                  ← Back to Form
                </button>
              </div>

              {savedLogs.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">
                  No feedback records found. Submit your first feedback!
                </p>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-2.5 pr-1">
                  {savedLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-700">{log.categoryLabel || log.category}</span>
                        <div className="flex text-amber-400">
                          {Array.from({ length: log.rating || 5 }).map((_, i) => (
                            <Star key={i} className="w-3 h-3 fill-amber-400" />
                          ))}
                        </div>
                      </div>
                      <p className="text-slate-600 leading-snug">{log.comment}</p>
                      <span className="text-[10px] text-slate-400 block">
                        {new Date(log.submittedAt).toLocaleDateString()} at{" "}
                        {new Date(log.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Form Screen */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Star Rating */}
              <div className="text-center space-y-1.5 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-xs font-bold text-slate-600 block">
                  How accurate or helpful was your experience?
                </span>
                <div className="flex items-center justify-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(star)}
                      className="p-1 rounded-lg hover:scale-110 transition-transform cursor-pointer"
                    >
                      <Star
                        className={`w-6 h-6 transition-colors ${
                          (hoverRating || rating) >= star
                            ? "text-amber-400 fill-amber-400"
                            : "text-slate-300"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Category Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Select Feature Category:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`p-2.5 rounded-xl text-left border text-xs font-semibold transition-all cursor-pointer ${
                        category === cat.id
                          ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span>{cat.label}</span>
                      <span className="text-[10px] text-slate-400 font-normal block truncate">
                        {cat.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Feedback Chips */}
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-400 block">
                  Quick Comments:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_COMMENTS.map((qc) => (
                    <button
                      key={qc}
                      type="button"
                      onClick={() => setComment(qc)}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 transition-colors cursor-pointer"
                    >
                      {qc}
                    </button>
                  ))}
                </div>
              </div>

              {/* Comment Textarea */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  Your Comments / Details:
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share what worked well or any issue you noticed..."
                  rows={3}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none text-slate-700 placeholder-slate-400"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setShowHistory(true)}
                  className="text-xs font-semibold text-slate-500 hover:text-indigo-600 flex items-center gap-1 cursor-pointer"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>View Past Logs ({savedLogs.length})</span>
                </button>

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Feedback</span>
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
