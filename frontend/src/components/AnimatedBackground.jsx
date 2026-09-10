import { motion } from "framer-motion";

const blobs = [
  { top: "-10%", left: "-8%", size: 480, color: "bg-brand-50/60", delay: 0 },
  { top: "20%", right: "-12%", size: 420, color: "bg-emerald-200/40", delay: 1.2 },
  { bottom: "-15%", left: "25%", size: 460, color: "bg-brand-50/50", delay: 2.4 },
];

export default function AnimatedBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-gradient-to-br from-brand-50 via-white to-emerald-50" />
      {blobs.map((b, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full ${b.color} blur-3xl`}
          style={{ width: b.size, height: b.size }}
          animate={{ y: [0, -20, 0], x: [0, 15, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: b.delay }}
        />
      ))}
      {/* subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(37,99,235,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.6) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
    </div>
  );
}