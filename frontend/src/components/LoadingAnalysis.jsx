import { motion } from "framer-motion";
import { BrainCircuit, Loader2 } from "lucide-react";

export default function LoadingAnalysis({ hint }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass flex flex-col items-center justify-center gap-5 rounded-3xl px-6 py-14 text-center"
    >
      <div className="relative">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
          className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-brand-blue/10 border-t-brand-blue border-r-emerald-500"
        >
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          >
            <BrainCircuit className="h-8 w-8 text-brand-blue" />
          </motion.div>
        </motion.div>
      </div>
      <div>
        <p className="font-display text-lg font-bold text-brand-ink">Analyzing your food…</p>
        <p className="mt-1 text-sm text-slate-500">Running the MobileNetV2 neural network</p>
      </div>
      <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        {hint || "Estimating carbohydrates & calories"}
      </div>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="h-1 rounded-full bg-gradient-to-r from-brand-blue to-emerald-500"
          style={{ width: ["40%", "60%", "80%", "60%"][i] }}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.3 }}
        />
      ))}
    </motion.div>
  );
}