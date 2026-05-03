import { useState } from "react";
import { auth } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";

export default function AuthPage({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (!email || !password) { setError("Please fill all fields."); return; }
    if (!isLogin && !name) { setError("Please enter your name."); return; }
    setError(""); setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      onLogin();
    } catch (e) {
      setError(e.message.replace("Firebase: ", "").replace(/\(.*\)/, ""));
    }
    setLoading(false);
  };

  return (
    <div style={S.root}>
      <div style={S.bgOrb1} />
      <div style={S.bgOrb2} />
      <div style={S.card}>
        <div style={S.logo}>✦</div>
        <h1 style={S.title}>Interview Bot</h1>
        <p style={S.sub}>{isLogin ? "Welcome back! Sign in to continue." : "Create your account to get started."}</p>

        <div style={S.tabs}>
          <button style={{ ...S.tab, ...(isLogin ? S.tabActive : {}) }} onClick={() => { setIsLogin(true); setError(""); }}>Sign In</button>
          <button style={{ ...S.tab, ...(!isLogin ? S.tabActive : {}) }} onClick={() => { setIsLogin(false); setError(""); }}>Sign Up</button>
        </div>

        {!isLogin && (
          <input style={S.input} placeholder="Your Name" value={name}
            onChange={e => setName(e.target.value)} />
        )}
        <input style={S.input} placeholder="Email address" type="email"
          value={email} onChange={e => setEmail(e.target.value)} />
        <input style={S.input} placeholder="Password" type="password"
          value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handle()} />

        {error && <p style={S.error}>{error}</p>}

        <button style={{ ...S.btn, opacity: loading ? 0.7 : 1 }}
          onClick={handle} disabled={loading}>
          {loading ? "Please wait..." : isLogin ? "Sign In →" : "Create Account →"}
        </button>

        <p style={S.toggle}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <span style={S.link} onClick={() => { setIsLogin(!isLogin); setError(""); }}>
            {isLogin ? "Sign Up" : "Sign In"}
          </span>
        </p>
      </div>
    </div>
  );
}

const S = {
  root: {
    minHeight: "100vh", display: "flex", alignItems: "center",
    justifyContent: "center", background: "#0d0a1a",
    fontFamily: "'Outfit', 'Segoe UI', sans-serif", position: "relative", overflow: "hidden",
  },
  bgOrb1: {
    position: "fixed", top: -200, left: -200, width: 500, height: 500,
    borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  bgOrb2: {
    position: "fixed", bottom: -200, right: -200, width: 500, height: 500,
    borderRadius: "50%", background: "radial-gradient(circle, rgba(232,121,249,0.15) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  card: {
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(167,139,250,0.2)",
    borderRadius: 24, padding: "40px 36px", width: "100%", maxWidth: 400,
    position: "relative", zIndex: 1,
  },
  logo: {
    fontSize: 28, color: "#a78bfa", textAlign: "center", marginBottom: 8,
  },
  title: {
    fontSize: 26, fontWeight: 900, color: "#f5f3ff", textAlign: "center",
    margin: "0 0 8px", letterSpacing: "-0.02em",
  },
  sub: {
    fontSize: 14, color: "rgba(245,243,255,0.5)", textAlign: "center",
    margin: "0 0 28px", lineHeight: 1.6,
  },
  tabs: {
    display: "grid", gridTemplateColumns: "1fr 1fr",
    background: "rgba(255,255,255,0.04)", borderRadius: 12,
    padding: 4, marginBottom: 20, gap: 4,
  },
  tab: {
    padding: "10px", border: "none", borderRadius: 10,
    background: "transparent", color: "rgba(245,243,255,0.5)",
    fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
  },
  tabActive: {
    background: "linear-gradient(135deg, #7c3aed, #a855f7)",
    color: "white", boxShadow: "0 2px 12px rgba(124,58,237,0.3)",
  },
  input: {
    width: "100%", background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(167,139,250,0.2)", borderRadius: 12,
    padding: "13px 16px", fontSize: 14, color: "#f5f3ff",
    fontFamily: "inherit", outline: "none", marginBottom: 12,
    boxSizing: "border-box",
  },
  error: { color: "#f472b6", fontSize: 13, marginBottom: 12, textAlign: "center" },
  btn: {
    width: "100%", background: "linear-gradient(135deg, #7c3aed, #a855f7, #c026d3)",
    color: "white", border: "none", borderRadius: 12, padding: "14px",
    fontSize: 15, fontWeight: 700, cursor: "pointer",
    boxShadow: "0 4px 20px rgba(124,58,237,0.35)", marginTop: 4,
  },
  toggle: {
    fontSize: 13, color: "rgba(245,243,255,0.4)", textAlign: "center", marginTop: 20,
  },
  link: { color: "#a78bfa", cursor: "pointer", fontWeight: 600 },
};