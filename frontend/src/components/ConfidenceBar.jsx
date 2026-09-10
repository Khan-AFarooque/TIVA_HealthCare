import { motion } from "framer-motion";

export default function ConfidenceBar({ confidence }) {
  const pct = Math.round(confidence * 100);
  const color =
    pct >= 75 ? "from-brand-blue to-emerald-500" : pct >= 60 ? "from-amber-400 to-orange-500" : "from-red-400 to-red-500";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium text-slate-500">Confidence</span>
        <span className="font-display font-bold text-brand-ink">{pct}%</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
        <motion.div
          className={`h-full rounded-full bg-gradient-to-r ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}