import { useState, useEffect, useRef } from "react";
import { auth, db } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, addDoc, getDocs, query, where, orderBy } from "firebase/firestore";
import AuthPage from "./AuthPage";

// ── DATA ──────────────────────────────────────────────────────────────────────

const ROLES = [
  { id: "java", label: "Java Developer", icon: "☕", color: "#a78bfa" },
  { id: "python", label: "Python Developer", icon: "🐍", color: "#c4b5fd" },
  { id: "aiml", label: "AI/ML Intern", icon: "🤖", color: "#818cf8" },
  { id: "cloud", label: "Cloud Engineer", icon: "☁️", color: "#a5b4fc" },
  { id: "fullstack", label: "Full Stack Dev", icon: "⚡", color: "#e879f9" },
];

const HR_QUESTIONS = [
  "Tell me about yourself and your background.",
  "Why should we hire you over other candidates?",
  "What are your biggest strengths and weaknesses?",
  "Where do you see yourself in 5 years?",
  "Why do you want this role at our company?",
  "Tell me about a challenge you faced and how you overcame it.",
  "How do you handle pressure and tight deadlines?",
  "Are you a team player or do you prefer working alone?",
  "What makes you unique compared to other applicants?",
  "What do you know about our company and why do you want to join?",
];

const TECH_QUESTIONS = {
  java: ["Explain the four pillars of OOP with real-world examples.", "What is the difference between an abstract class and an interface?", "How does Java handle memory management and garbage collection?", "Explain multithreading and how to handle race conditions.", "What are Java Streams and how do they improve code readability?", "Explain checked vs unchecked exceptions.", "What is the Collections framework?"],
  python: ["Difference between list, tuple, and dictionary?", "Explain Python decorators with a practical use case.", "How does Python's GIL affect concurrency?", "What are generators and how do they differ from regular functions?", "Explain shallow copy vs deep copy.", "What are list comprehensions?", "How would you optimize a slow Python script?"],
  aiml: ["Explain supervised, unsupervised, and reinforcement learning.", "What is overfitting and how do you prevent it?", "Explain gradient descent in neural networks.", "Difference between precision and recall?", "How does a transformer model work at a high level?", "What is the difference between a validation set and test set?", "Explain what a confusion matrix is."],
  cloud: ["Difference between IaaS, PaaS, and SaaS?", "What is containerization and how does Docker differ from a VM?", "Explain auto-scaling and when you'd use it.", "What are microservices vs monolithic architecture?", "How would you design a highly available fault-tolerant system?", "What is a load balancer?", "Explain CI/CD pipelines."],
  fullstack: ["Difference between REST and GraphQL APIs?", "How does the browser's event loop work in JavaScript?", "SQL vs NoSQL databases — when would you use each?", "Explain state management in React and when to use Redux.", "What is CORS and how do you handle it?", "Difference between authentication and authorization?", "How does HTTPS work?"],
};

const TOTAL_HR = 3;
const TOTAL_TECH = 4;
const TOTAL_Q = TOTAL_HR + TOTAL_TECH;

const systemPrompt = `You are a warm but professional interview coach. Respond ONLY with valid JSON (no markdown):
{"score":<1-10>,"communication":"<Excellent|Good|Fair|Needs Work>","missing_points":["..."],"feedback":"<2-3 sentences>","sample_answer":"<3-5 sentences>"}`;

// ── APP ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [phase, setPhase] = useState("landing"); // landing|role|interview|report|history
  const [selectedRole, setSelectedRole] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [questionTypes, setQuestionTypes] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answer, setAnswer] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [animIn, setAnimIn] = useState(true);
  const [timeLeft, setTimeLeft] = useState(null);
  const [timerActive, setTimerActive] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const timerRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setAuthLoading(false); });
    return unsub;
  }, []);

  useEffect(() => {
    if (timerActive && timeLeft > 0) timerRef.current = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    else if (timeLeft === 0) setTimerActive(false);
    return () => clearTimeout(timerRef.current);
  }, [timerActive, timeLeft]);

  const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);

  const transition = (next) => {
    setAnimIn(false);
    setTimeout(() => { setPhase(next); setAnimIn(true); }, 280);
  };

  const startInterview = (role) => {
    setSelectedRole(role);
    setQuestions([...shuffle(HR_QUESTIONS).slice(0, TOTAL_HR), ...shuffle(TECH_QUESTIONS[role.id]).slice(0, TOTAL_TECH)]);
    setQuestionTypes([...Array(TOTAL_HR).fill("HR"), ...Array(TOTAL_TECH).fill("Technical")]);
    setCurrentQ(0); setResults([]); setAnswer(""); setTimeLeft(null);
    transition("interview");
  };

  const submitAnswer = async () => {
    if (!answer.trim()) { setError("Please write an answer."); return; }
    setError(""); setLoading(true); setTimerActive(false);
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${import.meta.env.VITE_GEMINI_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemPrompt}\n\nRole: ${selectedRole.label}\nType: ${questionTypes[currentQ]}\nQ: ${questions[currentQ]}\nAnswer: ${answer}` }] }]
          }),
        }
      );

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      const parsed = JSON.parse(text.replace(/json|/g, "").trim());
      const newResults = [...results, { question: questions[currentQ], answer, type: questionTypes[currentQ], ...parsed }];
      setResults(newResults);
      if (currentQ + 1 < TOTAL_Q) {
        setCurrentQ(q => q + 1); setAnswer(""); setTimeLeft(null);
        setTimeout(() => textareaRef.current?.focus(), 100);
      } else {
        // Save to Firestore
        const avg = (newResults.reduce((s, r) => s + r.score, 0) / newResults.length).toFixed(1);
        const hrAvg = (newResults.filter(r => r.type === "HR").reduce((s, r) => s + r.score, 0) / TOTAL_HR).toFixed(1);
        const techAvg = (newResults.filter(r => r.type === "Technical").reduce((s, r) => s + r.score, 0) / TOTAL_TECH).toFixed(1);
        await addDoc(collection(db, "sessions"), {
          userId: user.uid, role: selectedRole.label, roleIcon: selectedRole.icon,
          date: new Date().toISOString(), overallScore: Number(avg),
          hrScore: Number(hrAvg), techScore: Number(techAvg),
          results: newResults,
        });
        transition("report");
      }
    } catch (e) { setError("Failed to get feedback. Try again.");console.log(e); }
    setLoading(false);
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const q = query(collection(db, "sessions"), where("userId", "==", user.uid), orderBy("date", "desc"));
      const snap = await getDocs(q);
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { setHistory([]); }
    setHistoryLoading(false);
    transition("history");
  };

  const avg = results.length ? (results.reduce((s, r) => s + r.score, 0) / results.length).toFixed(1) : 0;
  const hrAvg = results.filter(r => r.type === "HR").length ? (results.filter(r => r.type === "HR").reduce((s, r) => s + r.score, 0) / TOTAL_HR).toFixed(1) : "-";
  const techAvg = results.filter(r => r.type === "Technical").length ? (results.filter(r => r.type === "Technical").reduce((s, r) => s + r.score, 0) / TOTAL_TECH).toFixed(1) : "-";
  const getGrade = s => { const n = Number(s); if (n >= 8.5) return { l: "Exceptional 🌟", c: "#a78bfa" }; if (n >= 7) return { l: "Strong 💪", c: "#c4b5fd" }; if (n >= 5.5) return { l: "Average 📈", c: "#e879f9" }; return { l: "Keep Practicing 🔥", c: "#f472b6" }; };
  const grade = getGrade(avg);
  const isHR = currentQ < TOTAL_HR;
  const timerColor = timeLeft <= 15 ? "#f472b6" : timeLeft <= 30 ? "#e879f9" : "#a78bfa";

  if (authLoading) return <div style={{ minHeight: "100vh", background: "#0d0a1a", display: "flex", alignItems: "center", justifyContent: "center", color: "#a78bfa", fontSize: 18, fontFamily: "Outfit, sans-serif" }}>Loading...</div>;
  if (!user) return <AuthPage onLogin={() => setPhase("landing")} />;

  return (
    <div style={S.root}>
      <div style={S.orb1} /><div style={S.orb2} /><div style={S.dots} />

      {/* Top bar */}
      <div style={S.topBar}>
        <span style={S.brand}>✦ Interview Bot</span>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button style={S.navBtn} onClick={loadHistory}>📊 History</button>
          <span style={{ fontSize: 13, color: "rgba(245,243,255,0.4)" }}>{user.email}</span>
          <button style={S.navBtn} onClick={() => signOut(auth)}>Sign Out</button>
        </div>
      </div>

      <div style={{ ...S.wrap, opacity: animIn ? 1 : 0, transform: animIn ? "translateY(0)" : "translateY(12px)", transition: "opacity 0.28s, transform 0.28s" }}>

        {/* ── LANDING ── */}
        {phase === "landing" && (
          <div style={S.center}>
            <div style={S.chip}>✦ AI-POWERED INTERVIEW COACH</div>
            <h1 style={S.hero}>Land Your<br /><span style={S.grad}>Dream Job.</span></h1>
            <p style={S.heroSub}>Practice HR & Technical questions, get instant AI feedback, and walk in confident.</p>
            <div style={S.pills}>
              {["3 HR Questions", "4 Technical Questions", "AI Scoring /10", "Session History"].map(t => <span key={t} style={S.pill}>{t}</span>)}
            </div>
            <button style={S.btnPrimary} onClick={() => transition("role")}>Start Interview Practice →</button>
          </div>
        )}

        {/* ── ROLE ── */}
        {phase === "role" && (
          <div>
            <button style={S.back} onClick={() => transition("landing")}>← Back</button>
            <h2 style={S.secTitle}>Choose Your Role</h2>
            <p style={S.secSub}>You'll get <b style={{ color: "#e879f9" }}>3 HR</b> + <b style={{ color: "#a78bfa" }}>4 Technical</b> questions.</p>
            <div style={S.roleGrid}>
              {ROLES.map(r => (
                <button key={r.id} style={S.roleCard} onClick={() => startInterview(r)}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = r.color; e.currentTarget.style.background = `${r.color}18`; e.currentTarget.style.transform = "translateY(-4px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(167,139,250,0.15)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.transform = "translateY(0)"; }}>
                  <span style={{ fontSize: 30 }}>{r.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#f5f3ff" }}>{r.label}</span>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: r.color }} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── INTERVIEW ── */}
        {phase === "interview" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22, flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={S.chip2}>{selectedRole.icon} {selectedRole.label}</span>
                <span style={{ ...S.chip2, background: isHR ? "rgba(232,121,249,0.12)" : "rgba(167,139,250,0.12)", color: isHR ? "#e879f9" : "#a78bfa", borderColor: isHR ? "rgba(232,121,249,0.3)" : "rgba(167,139,250,0.3)" }}>
                  {isHR ? "🧠 HR Round" : "💻 Technical"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                {Array.from({ length: TOTAL_Q }).map((_, i) => (
                  <div key={i} style={{ width: 8, height: 8, borderRadius: i < TOTAL_HR ? 3 : "50%", background: i < currentQ ? "#a78bfa" : i === currentQ ? "white" : "rgba(255,255,255,0.15)", transition: "background 0.3s" }} />
                ))}
                <span style={{ fontSize: 11, color: "rgba(245,243,255,0.4)", marginLeft: 4 }}>{currentQ + 1}/{TOTAL_Q}</span>
              </div>
            </div>

            <div style={{ ...S.qCard, borderColor: isHR ? "rgba(232,121,249,0.2)" : "rgba(167,139,250,0.2)" }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase", color: isHR ? "#e879f9" : "#a78bfa", marginBottom: 12 }}>
                {isHR ? "HR Question" : "Technical Question"} · {currentQ + 1} of {TOTAL_Q}
              </div>
              <p style={S.qText}>{questions[currentQ]}</p>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: "rgba(245,243,255,0.4)", textTransform: "uppercase" }}>Your Answer</span>
                {timeLeft !== null
                  ? <span style={{ fontSize: 14, fontWeight: 800, color: timerColor }}>{timeLeft}s</span>
                  : <button style={S.timerBtn} onClick={() => { setTimeLeft(60); setTimerActive(true); }}>⏱ 60s Timer</button>}
              </div>
              <textarea ref={textareaRef} style={S.textarea}
                placeholder={isHR ? "Share your story clearly and confidently..." : "Explain with examples and technical detail..."}
                value={answer} onChange={e => setAnswer(e.target.value)} rows={7} />
              {error && <p style={{ color: "#f472b6", fontSize: 13, marginTop: 8 }}>{error}</p>}
              <button style={{ ...S.btnPrimary, marginTop: 14, opacity: loading ? 0.6 : 1 }}
                onClick={submitAnswer} disabled={loading}>
                {loading ? "✨ Analysing..." : currentQ + 1 < TOTAL_Q ? "Submit & Next →" : "Submit & View Report →"}
              </button>
            </div>

            {results.length > 0 && (
              <div style={S.prevBox}>
                <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "rgba(245,243,255,0.3)", textTransform: "uppercase", marginBottom: 10 }}>Previous</p>
                {results.map((r, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", gap: 10 }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: r.type === "HR" ? "#e879f9" : "#a78bfa", background: r.type === "HR" ? "rgba(232,121,249,0.1)" : "rgba(167,139,250,0.1)", borderRadius: 5, padding: "2px 7px" }}>{r.type}</span>
                      <span style={{ fontSize: 12, color: "rgba(245,243,255,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.question.slice(0, 45)}...</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: r.score >= 7 ? "#c4b5fd" : "#f472b6", background: r.score >= 7 ? "rgba(167,139,250,0.12)" : "rgba(244,114,182,0.1)", borderRadius: 100, padding: "3px 10px", whiteSpace: "nowrap" }}>{r.score}/10</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* ── REPORT ── */}
        {phase === "report" && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 28, paddingBottom: 24, borderBottom: "1px solid rgba(167,139,250,0.12)" }}>
              <div style={S.chip}>✦ Interview Complete · Saved to History</div>
              <h2 style={{ ...S.secTitle, marginTop: 12 }}>{selectedRole.icon} {selectedRole.label}</h2>
              <div style={S.scoreCards}>
                {[{ label: "Overall", val: avg, color: grade.c, sub: grade.l }, { label: "HR Round", val: hrAvg, color: "#e879f9", sub: "Behavioural" }, { label: "Technical", val: techAvg, color: "#a78bfa", sub: "Knowledge" }].map(s => (
                  <div key={s.label} style={S.scoreCard}>
                    <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "rgba(245,243,255,0.35)", textTransform: "uppercase", marginBottom: 6 }}>{s.label}</span>
                    <span style={{ fontSize: 42, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.val}</span>
                    <span style={{ fontSize: 14, color: "rgba(245,243,255,0.3)" }}>/10</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: s.color, marginTop: 4 }}>{s.sub}</span>
                  </div>
                ))}
              </div>

              {/* Mini bar chart */}
              <div style={{ marginTop: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "rgba(245,243,255,0.3)", textTransform: "uppercase", marginBottom: 14 }}>Score Breakdown</p>
                {results.map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: "rgba(245,243,255,0.4)", width: 20, textAlign: "right" }}>Q{i + 1}</span>
                    <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${r.score * 10}%`, height: "100%", background: r.type === "HR" ? "linear-gradient(90deg,#e879f9,#a78bfa)" : "linear-gradient(90deg,#7c3aed,#a855f7)", borderRadius: 4, transition: "width 0.8s ease" }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: r.score >= 7 ? "#c4b5fd" : "#f472b6", width: 30 }}>{r.score}/10</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
              {results.map((r, i) => (
                <div key={i} style={{ ...S.resCard, borderColor: r.type === "HR" ? "rgba(232,121,249,0.15)" : "rgba(167,139,250,0.15)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: "rgba(245,243,255,0.3)", letterSpacing: "0.15em" }}>Q{i + 1}</span>
                      <span style={{ fontSize: 10, fontWeight: 800, color: r.type === "HR" ? "#e879f9" : "#a78bfa", background: r.type === "HR" ? "rgba(232,121,249,0.1)" : "rgba(167,139,250,0.1)", borderRadius: 6, padding: "2px 8px" }}>{r.type}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: r.score >= 7 ? "#c4b5fd" : "#f472b6", background: r.score >= 7 ? "rgba(167,139,250,0.12)" : "rgba(244,114,182,0.1)", borderRadius: 100, padding: "3px 10px" }}>{r.score}/10 · {r.communication}</span>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#f5f3ff", margin: "0 0 8px", lineHeight: 1.5 }}>{r.question}</p>
                  <p style={{ fontSize: 13, color: "rgba(245,243,255,0.6)", lineHeight: 1.7, margin: "0 0 10px" }}>{r.feedback}</p>
                  {r.missing_points?.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <p style={{ fontSize: 11, fontWeight: 800, color: "rgba(245,243,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Missing Points</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {r.missing_points.map((mp, j) => <span key={j} style={{ fontSize: 12, color: "#e879f9", background: "rgba(232,121,249,0.08)", border: "1px solid rgba(232,121,249,0.2)", borderRadius: 6, padding: "3px 10px" }}>• {mp}</span>)}
                      </div>
                    </div>
                  )}
                  <details style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10 }}>
                    <summary style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa", cursor: "pointer", listStyle: "none" }}>✦ View Sample Answer</summary>
                    <p style={{ fontSize: 13, color: "rgba(245,243,255,0.65)", lineHeight: 1.7, marginTop: 10, paddingLeft: 12, borderLeft: "2px solid rgba(167,139,250,0.3)" }}>{r.sample_answer}</p>
                  </details>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <button style={S.btnSecondary} onClick={() => startInterview(selectedRole)}>Retry Same Role</button>
              <button style={S.btnPrimary} onClick={() => transition("role")}>Try Different Role →</button>
            </div>
          </div>
        )}

        {/* ── HISTORY ── */}
        {phase === "history" && (
          <div>
            <button style={S.back} onClick={() => transition("landing")}>← Back</button>
            <h2 style={S.secTitle}>📊 Your History</h2>
            <p style={S.secSub}>All your past interview sessions saved here.</p>
            {historyLoading && <p style={{ color: "rgba(245,243,255,0.4)", textAlign: "center", marginTop: 40 }}>Loading sessions...</p>}
            {!historyLoading && history.length === 0 && (
              <div style={{ textAlign: "center", marginTop: 60 }}>
                <p style={{ fontSize: 40, marginBottom: 16 }}>📭</p>
                <p style={{ color: "rgba(245,243,255,0.4)", fontSize: 16 }}>No sessions yet. Start your first interview!</p>
                <button style={{ ...S.btnPrimary, marginTop: 20, maxWidth: 280, margin: "20px auto 0" }} onClick={() => transition("role")}>Start Interview →</button>
              </div>
            )}
            {!historyLoading && history.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Overall progress chart */}
                <div style={{ ...S.resCard, borderColor: "rgba(167,139,250,0.15)", marginBottom: 8 }}>
                  <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "rgba(245,243,255,0.3)", textTransform: "uppercase", marginBottom: 16 }}>Overall Score Trend</p>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 80 }}>
                    {history.slice(0, 10).reverse().map((s, i) => (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 10, color: "#a78bfa" }}>{s.overallScore}</span>
                        <div style={{ width: "100%", height: `${s.overallScore * 8}px`, background: "linear-gradient(180deg,#7c3aed,#e879f9)", borderRadius: "4px 4px 0 0", minHeight: 4 }} />
                        <span style={{ fontSize: 9, color: "rgba(245,243,255,0.3)", textAlign: "center" }}>{s.roleIcon}</span>
                      </div>
                    ))}
                  </div>
                </div>{history.map((s, i) => (
                  <div key={s.id} style={{ ...S.resCard, borderColor: "rgba(167,139,250,0.12)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div>
                        <span style={{ fontSize: 15, fontWeight: 700, color: "#f5f3ff" }}>{s.roleIcon} {s.role}</span>
                        <span style={{ fontSize: 12, color: "rgba(245,243,255,0.35)", display: "block", marginTop: 2 }}>
                          {new Date(s.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: 24, fontWeight: 900, color: s.overallScore >= 7 ? "#a78bfa" : "#f472b6" }}>{s.overallScore}</span>
                        <span style={{ fontSize: 13, color: "rgba(245,243,255,0.3)" }}>/10</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <span style={{ fontSize: 12, color: "#e879f9", background: "rgba(232,121,249,0.1)", borderRadius: 6, padding: "3px 10px" }}>HR: {s.hrScore}/10</span>
                      <span style={{ fontSize: 12, color: "#a78bfa", background: "rgba(167,139,250,0.1)", borderRadius: 6, padding: "3px 10px" }}>Tech: {s.techScore}/10</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const S = {
  root: { minHeight: "100vh", background: "#0d0a1a", color: "#f5f3ff", fontFamily: "'Outfit','Segoe UI',sans-serif", position: "relative", overflowX: "hidden", paddingBottom: 60 },
  orb1: { position: "fixed", top: -180, left: -180, width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle,rgba(139,92,246,0.18) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 },
  orb2: { position: "fixed", bottom: -200, right: -200, width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle,rgba(232,121,249,0.12) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 },
  dots: { position: "fixed", inset: 0, backgroundImage: "radial-gradient(rgba(167,139,250,0.1) 1px,transparent 1px)", backgroundSize: "32px 32px", pointerEvents: "none", zIndex: 0 },
  topBar: { position: "relative", zIndex: 2, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", borderBottom: "1px solid rgba(167,139,250,0.1)", background: "rgba(13,10,26,0.8)", backdropFilter: "blur(10px)" },
  brand: { fontSize: 16, fontWeight: 800, color: "#a78bfa", letterSpacing: "-0.01em" },
  navBtn: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(167,139,250,0.2)", color: "#c4b5fd", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  wrap: { position: "relative", zIndex: 1, maxWidth: 720, margin: "0 auto", padding: "40px 24px" },
  center: { display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", paddingTop: 24 },
  chip: { fontSize: 11, fontWeight: 800, letterSpacing: "0.18em", color: "#a78bfa", background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.25)", borderRadius: 100, padding: "6px 18px", marginBottom: 28, display: "inline-block" },
  chip2: { fontSize: 12, fontWeight: 700, color: "rgba(245,243,255,0.6)", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(167,139,250,0.15)", borderRadius: 100, padding: "5px 14px" },
  hero: { fontSize: "clamp(42px,8vw,70px)", fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.03em", color: "#f5f3ff", margin: "0 0 18px" },
  grad: { background: "linear-gradient(135deg,#a78bfa 0%,#e879f9 50%,#c4b5fd 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" },
  heroSub: { fontSize: 16, color: "rgba(245,243,255,0.5)", lineHeight: 1.7, maxWidth: 440, margin: "0 0 24px" },
  pills: { display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 32 },
  pill: { fontSize: 12, fontWeight: 600, color: "rgba(245,243,255,0.6)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 100, padding: "5px 14px" },
  btnPrimary: { background: "linear-gradient(135deg,#7c3aed,#a855f7,#c026d3)", color: "white", border: "none", borderRadius: 14, padding: "14px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 24px rgba(124,58,237,0.35)", display: "block", width: "100%", transition: "transform 0.15s" },
  btnSecondary: { background: "rgba(255,255,255,0.05)", color: "#f5f3ff", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 14, padding: "14px 32px", fontSize: 15, fontWeight: 600, cursor: "pointer" },
  back: { background: "none", border: "none", color: "rgba(245,243,255,0.4)", fontSize: 14, cursor: "pointer", padding: "0 0 22px", display: "block", fontWeight: 500 },
  secTitle: { fontSize: 30, fontWeight: 900, letterSpacing: "-0.025em", margin: "0 0 8px", color: "#f5f3ff" },
  secSub: { color: "rgba(245,243,255,0.5)", fontSize: 14, margin: "0 0 24px", lineHeight: 1.6 },
  roleGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(185px,1fr))", gap: 12 },
  roleCard: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(167,139,250,0.15)", borderRadius: 18, padding: "20px 18px 16px", cursor: "pointer", transition: "all 0.2s", textAlign: "left" },
  qCard: { background: "rgba(255,255,255,0.04)", border: "1px solid", borderRadius: 20, padding: "24px 26px", marginBottom: 16 },
  qText: { fontSize: 18, fontWeight: 700, lineHeight: 1.55, color: "#f5f3ff", margin: 0 },
  timerBtn: { background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.25)", color: "#c4b5fd", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  textarea: { width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 16, padding: "14px 16px", fontSize: 15, color: "#f5f3ff", resize: "vertical", fontFamily: "inherit", lineHeight: 1.65, outline: "none", boxSizing: "border-box" },
  prevBox: { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(167,139,250,0.1)", borderRadius: 14, padding: "14px 18px" },
  scoreCards: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginTop: 20 },
  scoreCard: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(167,139,250,0.15)", borderRadius: 18, padding: "18px 14px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 },
  resCard: { background: "rgba(255,255,255,0.03)", border: "1px solid", borderRadius: 20, padding: "20px 22px" },
};