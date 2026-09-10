import { motion, AnimatePresence } from "framer-motion";
import { History, Trash2, Wheat, Clock } from "lucide-react";

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function HistoryPanel({ history, clearHistory, onSelect }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="glass rounded-3xl p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 font-display font-bold text-brand-ink">
          <History className="h-5 w-5 text-brand-blue" /> Scan History
        </div>
        {history.length > 0 && (
          <button
            onClick={clearHistory}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear all
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">
          No scans yet. Your predictions will appear here.
        </p>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {history.map((item) => (
              <motion.li
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                onClick={() => onSelect && onSelect(item)}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-white/70 p-3 ring-1 ring-slate-200/70 transition hover:scale-[1.01] hover:bg-white hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  {item.image ? (
                    <img src={item.image} alt="" className="h-11 w-11 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-blue/10">
                      <Wheat className="h-5 w-5 text-brand-blue" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-brand-ink">{item.food_name}</p>
                    <p className="text-xs text-slate-400">
                      {item.carbs_g != null ? `${item.carbs_g} g carbs · ${item.calories_kcal} kcal` : "Nutrition data unavailable"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-600">
                    {(item.confidence * 100).toFixed(0)}%
                  </span>
                  <span className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                    <Clock className="h-3 w-3" /> {timeAgo(item.createdAt)}
                  </span>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </motion.div>
  );
}