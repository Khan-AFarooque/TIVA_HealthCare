import { motion } from "framer-motion";

export default function Header({ showLogo = true, showGreeting = false, userName = "" }) {
  const logoSrc = `${import.meta.env.BASE_URL}assets/tiva-logo.png`;

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="sticky top-0 z-40 w-full bg-brand-ink/95 backdrop-blur-sm border-b border-white/10"
    >
      <div className="glass mx-auto mt-4 flex max-w-6xl items-center justify-between rounded-2xl px-5 py-3">
        {showLogo && (
          <div className="flex items-center gap-2">
            <img
              src={logoSrc}
              onError={(e) => { e.currentTarget.src = "./assets/tiva-logo.png"; }}
              alt="TIVA Logo"
              className="h-6 w-auto object-contain"
            />
            <p className="font-display text-lg font-bold text-brand-ink">TIVA</p>
          </div>
        )}

        {showGreeting && userName && (
          <div className="hidden sm:items-center gap-2 text-sm font-medium text-slate-400">
            Hello, {userName}
          </div>
        )}

        {!showGreeting && (
          <div className="hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 sm:flex">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            AI Ready
          </div>
        )}
      </div>
    </motion.header>
  );
}
