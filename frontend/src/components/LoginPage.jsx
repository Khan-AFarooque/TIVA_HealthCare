import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, UserPlus, LogIn } from "lucide-react";

function generateUserId() {
  return "user_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
}

function getUsers() {
  try {
    return JSON.parse(localStorage.getItem("tiva_users")) || [];
  } catch {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem("tiva_users", JSON.stringify(users));
}

export default function LoginPage({ onLogin }) {
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const resetForm = () => {
    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setError("");
    setSuccessMsg("");
  };

  const handleSignup = async () => {
    setError("");
    setSuccessMsg("");
    setIsLoading(true);

    if (!name.trim()) {
      setError("Please enter your full name.");
      setIsLoading(false);
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      setIsLoading(false);
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      setIsLoading(false);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setIsLoading(false);
      return;
    }

    const users = getUsers();
    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      setError("An account with this email already exists.");
      setIsLoading(false);
      return;
    }

    await new Promise((r) => setTimeout(r, 600));

    const newUser = {
      id: generateUserId(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    saveUsers(users);

    setIsLoading(false);
    setSuccessMsg("Account created! Redirecting to login...");
    setTimeout(() => {
      resetForm();
      setIsSignup(false);
    }, 1500);
  };

  const handleLogin = async () => {
    setError("");
    setSuccessMsg("");
    setIsLoading(true);

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      setIsLoading(false);
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      setIsLoading(false);
      return;
    }

    const users = getUsers();
    const user = users.find(
      (u) =>
        u.email.toLowerCase() === email.trim().toLowerCase() &&
        u.password === password
    );

    if (!user) {
      setError("Invalid email or password. Please sign up first.");
      setIsLoading(false);
      return;
    }

    await new Promise((r) => setTimeout(r, 400));

    const session = {
      isLoggedIn: true,
      userId: user.id,
      name: user.name,
      email: user.email,
      ts: Date.now(),
    };
    localStorage.setItem("tiva_auth", JSON.stringify(session));
    setIsLoading(false);
    onLogin(user.name, user.id);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle decorative background elements */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-100/40 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-teal-100/40 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md p-8 rounded-[24px] bg-white shadow-[0_8px_40px_rgba(0,0,0,0.08)] border border-slate-200/60 relative z-10"
      >
        <div className="text-center mb-8">
          <img
            src="/assets/tiva-logo.png"
            alt="TIVA Logo"
            className="mx-auto mb-3 w-48 h-auto object-contain"
          />
          <h1 className="font-display text-3xl font-extrabold text-slate-900">
            TIVA
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Type 1 Diabetes Management & AI
          </p>
        </div>

        <AnimatePresence mode="wait">
          {isSignup ? (
            <motion.div
              key="signup"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <h2 className="font-display text-xl font-bold text-slate-900">
                Create Account
              </h2>
              <p className="text-slate-500 text-sm">
                Sign up to get started with TIVA
              </p>

              <div>
                <input
                  type="text"
                  placeholder="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 focus:border-brand-blue transition-colors"
                />
              </div>
              <div>
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 focus:border-brand-blue transition-colors"
                />
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password (min 6 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-10 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 focus:border-brand-blue transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-10 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 focus:border-brand-blue transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <button
                onClick={handleSignup}
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-emerald-600 text-white font-medium transition-all duration-200 hover:bg-emerald-700 shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <UserPlus size={18} />
                    Create Account
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  resetForm();
                  setIsSignup(false);
                }}
                className="w-full py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium transition-all duration-200 hover:bg-slate-50 hover:border-slate-300"
              >
                Already have an account? Sign In
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="login"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              <h2 className="font-display text-xl font-bold text-slate-900">
                Welcome Back
              </h2>
              <p className="text-slate-500 text-sm">
                Log in to continue with TIVA
              </p>

              <div>
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 focus:border-brand-blue transition-colors"
                />
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  className="w-full px-4 py-3 pr-10 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 focus:border-brand-blue transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <button
                onClick={handleLogin}
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-brand-blue text-white font-medium transition-all duration-200 hover:bg-brand-blue/90 shadow-lg shadow-brand-blue/25 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <LogIn size={18} />
                    Sign In
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  resetForm();
                  setIsSignup(true);
                }}
                className="w-full py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium transition-all duration-200 hover:bg-slate-50 hover:border-slate-300"
              >
                Don't have an account? Sign Up
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm text-center"
          >
            {error}
          </motion.div>
        )}
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm text-center"
          >
            {successMsg}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
