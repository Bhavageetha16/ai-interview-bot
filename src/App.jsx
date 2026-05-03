import { useState, useEffect, useRef } from "react";

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
  "Are you a team player or do you prefer working alone? Give an example.",
  "What makes you unique compared to other applicants?",
  "What do you know about our company and why do you want to join us?",
];

const TECH_QUESTIONS = {
  java: [
    "Explain the four pillars of Object-Oriented Programming with real-world examples.",
    "What is the difference between an abstract class and an interface in Java?",
    "How does Java handle memory management and garbage collection?",
    "Explain multithreading and how you'd handle race conditions.",
    "What are Java Streams and how do they improve code readability?",
    "Explain the difference between checked and unchecked exceptions.",
    "What is the Collections framework and name some common data structures?",
  ],
  python: [
    "What is the difference between a list, tuple, and dictionary in Python?",
    "Explain Python decorators and give a practical use case.",
    "How does Python's GIL affect concurrency?",
    "What are generators and how do they differ from regular functions?",
    "Explain the difference between shallow copy and deep copy.",
    "What are list comprehensions and when would you use them?",
    "How would you optimize a slow Python script?",
  ],
  aiml: [
    "Explain the difference between supervised, unsupervised, and reinforcement learning.",
    "What is overfitting and how do you prevent it?",
    "Explain gradient descent and how it works in neural networks.",
    "What is the difference between precision and recall?",
    "Explain how a transformer model works at a high level.",
    "What is the difference between a validation set and a test set?",
    "Explain what a confusion matrix is and how to read it.",
  ],
  cloud: [
    "Explain the difference between IaaS, PaaS, and SaaS with examples.",
    "What is containerization and how does Docker differ from a VM?",
    "Explain the concept of auto-scaling and when you'd use it.",
    "What are microservices and their trade-offs vs monolithic architecture?",
    "How would you design a highly available and fault-tolerant system?",
    "What is a load balancer and why is it important?",
    "Explain the concept of CI/CD pipelines.",
  ],
  fullstack: [
    "Explain the difference between REST and GraphQL APIs.",
    "How does the browser's event loop work in JavaScript?",
    "What is the difference between SQL and NoSQL databases?",
    "Explain state management in React and when you'd use Redux.",
    "What is CORS and how do you handle it?",
    "Explain the difference between authentication and authorization.",
    "How does HTTPS work and why is it important?",
  ],
};

const TOTAL_HR = 3;
const TOTAL_TECH = 4;
const TOTAL_QUESTIONS = TOTAL_HR + TOTAL_TECH;

const systemPrompt = `You are a warm but professional interview coach evaluating candidates. When given a question type, question, and candidate's answer, respond ONLY with a valid JSON object (no markdown, no code blocks) in this exact format:
{
  "score": <number 1-10>,
  "communication": "<Excellent|Good|Fair|Needs Work>",
  "missing_points": ["point1", "point2"],
  "feedback": "<2-3 sentence constructive feedback>",
  "sample_answer": "<A strong 3-5 sentence model answer>"
}
For HR questions, focus on clarity, confidence, and storytelling. For technical questions, focus on accuracy, depth, and examples. Be encouraging but honest.`;

export default function App() {
  const [phase, setPhase] = useState("landing");
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
  const timerRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (timerActive && timeLeft > 0) {
      timerRef.current = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    } else if (timeLeft === 0) setTimerActive(false);
    return () => clearTimeout(timerRef.current);
  }, [timerActive, timeLeft]);

  const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

  const startInterview = (role) => {
    const hrPicked = shuffle(HR_QUESTIONS).slice(0, TOTAL_HR);
    const techPicked = shuffle(TECH_QUESTIONS[role.id]).slice(0, TOTAL_TECH);
    const allQ = [...hrPicked, ...techPicked];
    const allTypes = [...Array(TOTAL_HR).fill("HR"), ...Array(TOTAL_TECH).fill("Technical")];
    setSelectedRole(role);
    setQuestions(allQ);
    setQuestionTypes(allTypes);
    setCurrentQ(0);
    setResults([]);
    setAnswer("");
    setTimeLeft(null);
    transition("interview");
  };

  const transition = (next) => {
    setAnimIn(false);
    setTimeout(() => { setPhase(next); setAnimIn(true); }, 280);
  };

  const submitAnswer = async () => {
    if (!answer.trim()) { setError("Please write an answer before submitting."); return; }
    setError("");
    setLoading(true);
    setTimerActive(false);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: systemPrompt,
          messages: [{
            role: "user",
            content: `Role: ${selectedRole.label}\nQuestion Type: ${questionTypes[currentQ]}\nQuestion: ${questions[currentQ]}\nCandidate Answer: ${answer}`,
          }],
        }),
      });
      const data = await res.json();
      const raw = data.content?.map((b) => b.text || "").join("") || "{}";
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      const newResults = [...results, { question: questions[currentQ], answer, type: questionTypes[currentQ], ...parsed }];
      setResults(newResults);
      if (currentQ + 1 < TOTAL_QUESTIONS) {
        setCurrentQ((q) => q + 1);
        setAnswer("");
        setTimeLeft(null);
        setTimeout(() => textareaRef.current?.focus(), 100);
      } else {
        transition("report");
      }
    } catch (e) {
      setError("Failed to get AI feedback. Please try again.");
    }
    setLoading(false);
  };

  const avgScore = results.length
    ? (results.reduce((s, r) => s + (r.score || 0), 0) / results.length).toFixed(1)
    : 0;
  const hrAvg = results.filter(r => r.type === "HR").length
    ? (results.filter(r => r.type === "HR").reduce((s, r) => s + r.score, 0) / results.filter(r => r.type === "HR").length).toFixed(1)
    : "-";
  const techAvg = results.filter(r => r.type === "Technical").length
    ? (results.filter(r => r.type === "Technical").reduce((s, r) => s + r.score, 0) / results.filter(r => r.type === "Technical").length).toFixed(1)
    : "-";

  const getGrade = (s) => {
    const n = Number(s);
    if (n >= 8.5) return { label: "Exceptional 🌟", color: "#a78bfa" };
    if (n >= 7) return { label: "Strong 💪", color: "#c4b5fd" };
    if (n >= 5.5) return { label: "Average 📈", color: "#e879f9" };
    return { label: "Keep Practicing 🔥", color: "#f472b6" };
  };
  const grade = getGrade(avgScore);
  const timerColor = timeLeft <= 15 ? "#f472b6" : timeLeft <= 30 ? "#e879f9" : "#a78bfa";
  const isHRPhase = currentQ < TOTAL_HR;

  return (
    <div style={S.root}>
      {/* Background */}
      <div style={S.bgOrb1} />
      <div style={S.bgOrb2} />
      <div style={S.bgOrb3} />
      <div style={S.bgDots} />

      <div style={{ ...S.wrap, opacity: animIn ? 1 : 0, transform: animIn ? "translateY(0)" : "translateY(14px)", transition: "opacity 0.28s ease, transform 0.28s ease" }}>

        {/* ── LANDING ── */}
        {phase === "landing" && (
          <div style={S.centerCol}>
            <div style={S.chip}>✦ AI-POWERED INTERVIEW COACH</div>
            <h1 style={S.hero}>
              Land Your<br />
              <span style={S.heroGrad}>Dream Job.</span>
            </h1>
            <p style={S.heroSub}>
              Practice HR & Technical questions, get instant AI feedback,
              and walk into every interview with confidence.
            </p>
            <div style={S.tags}>
              {["HR Questions", "Technical Round", "AI Scoring /10", "Sample Answers", "Full Report"].map(t => (
                <span key={t} style={S.tag}>{t}</span>
              ))}
            </div>
            <button style={S.btnPrimary} onClick={() => transition("role")}
              onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
              onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
              Start Interview Practice →
            </button>
          </div>
        )}

        {/* ── ROLE ── */}
        {phase === "role" && (
          <div>
            <button style={S.backBtn} onClick={() => transition("landing")}>← Back</button>
            <h2 style={S.secTitle}>Choose Your Role</h2>
            <p style={S.secSub}>You'll get <strong style={{ color: "#c4b5fd" }}>3 HR questions</strong> + <strong style={{ color: "#a78bfa" }}>4 Technical questions</strong> based on your role.</p>
            <div style={S.roleGrid}>
              {ROLES.map(role => (
                <button key={role.id} style={S.roleCard}
                  onClick={() => startInterview(role)}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = role.color; e.currentTarget.style.background = `${role.color}18`; e.currentTarget.style.transform = "translateY(-4px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(167,139,250,0.15)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.transform = "translateY(0)"; }}>
                  <span style={{ fontSize: 32 }}>{role.icon}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#f5f3ff" }}>{role.label}</span>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: role.color, marginTop: 4 }} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── INTERVIEW ── */}
        {phase === "interview" && (
          <div>
            {/* Header */}
            <div style={S.iHeader}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={S.roleChip}>{selectedRole.icon} {selectedRole.label}</span>
                <span style={{ ...S.roundChip, background: isHRPhase ? "rgba(232,121,249,0.15)" : "rgba(167,139,250,0.15)", color: isHRPhase ? "#e879f9" : "#a78bfa", border: `1px solid ${isHRPhase ? "rgba(232,121,249,0.3)" : "rgba(167,139,250,0.3)"}` }}>
                  {isHRPhase ? "🧠 HR Round" : "💻 Technical Round"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {Array.from({ length: TOTAL_QUESTIONS }).map((_, i) => (
                  <div key={i} style={{ width: i < TOTAL_HR ? 10 : 8, height: i < TOTAL_HR ? 10 : 8, borderRadius: i < TOTAL_HR ? 3 : "50%", background: i < currentQ ? "#a78bfa" : i === currentQ ? "white" : "rgba(255,255,255,0.15)", transition: "background 0.3s" }} />
                ))}
                <span style={{ fontSize: 12, color: "rgba(245,243,255,0.4)", marginLeft: 4, fontWeight: 600 }}>{currentQ + 1}/{TOTAL_QUESTIONS}</span>
              </div>
            </div>

            {/* Question */}
            <div style={{ ...S.qCard, borderColor: isHRPhase ? "rgba(232,121,249,0.2)" : "rgba(167,139,250,0.2)" }}>
              <div style={{ ...S.qLabel, color: isHRPhase ? "#e879f9" : "#a78bfa" }}>
                {isHRPhase ? "HR Question" : "Technical Question"} · {currentQ + 1} of {TOTAL_QUESTIONS}
              </div>
              <p style={S.qText}>{questions[currentQ]}</p>
            </div>

            {/* Answer */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={S.ansLabel}>Your Answer</span>
                {timeLeft !== null
                  ? <span style={{ fontSize: 14, fontWeight: 800, color: timerColor, fontVariantNumeric: "tabular-nums" }}>⏱ {timeLeft}s</span>
                  : <button style={S.timerBtn} onClick={() => { setTimeLeft(60); setTimerActive(true); }}>⏱ 60s Timer</button>}
              </div>
              <textarea ref={textareaRef} style={S.textarea}
                placeholder={isHRPhase ? "Share your story clearly and confidently..." : "Explain your answer with examples and technical detail..."}
                value={answer} onChange={e => setAnswer(e.target.value)} rows={7} />
              {error && <p style={{ color: "#f472b6", fontSize: 13, marginTop: 8 }}>{error}</p>}
              <button style={{ ...S.btnPrimary, marginTop: 14, opacity: loading ? 0.6 : 1 }}
                onClick={submitAnswer} disabled={loading}>
                {loading ? "✨ Analysing your answer..." : currentQ + 1 < TOTAL_QUESTIONS ? "Submit & Next Question →" : "Submit & View Report →"}
              </button>
            </div>

            {/* Previous scores */}
            {results.length > 0 && (
              <div style={S.prevBox}>
                <p style={S.prevTitle}>Previous Answers</p>
                {results.map((r, i) => (
                  <div key={i} style={S.prevRow}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flex: 1, minWidth: 0 }}>
                      <span style={{ ...S.typeTag, background: r.type === "HR" ? "rgba(232,121,249,0.1)" : "rgba(167,139,250,0.1)", color: r.type === "HR" ? "#e879f9" : "#a78bfa" }}>{r.type}</span>
                      <span style={{ fontSize: 12, color: "rgba(245,243,255,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.question.slice(0, 50)}...</span>
                    </div>
                    <span style={{ ...S.scorePill, background: r.score >= 7 ? "rgba(167,139,250,0.15)" : "rgba(244,114,182,0.12)", color: r.score >= 7 ? "#c4b5fd" : "#f472b6" }}>{r.score}/10</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── REPORT ── */}
        {phase === "report" && (
          <div>
            <div style={S.reportTop}>
              <div style={S.chip}>✦ Interview Complete</div>
              <h2 style={{ ...S.secTitle, marginTop: 12 }}>{selectedRole.icon} {selectedRole.label}</h2>

              {/* Score cards */}
              <div style={S.scoreCards}>
                <div style={S.scoreCard}>
                  <span style={S.scoreCardLabel}>Overall</span>
                  <span style={{ ...S.scoreCardNum, color: grade.color }}>{avgScore}</span>
                  <span style={S.scoreCardSub}>/10</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: grade.color, marginTop: 4 }}>{grade.label}</span>
                </div>
                <div style={S.scoreCard}>
                  <span style={S.scoreCardLabel}>HR Round</span>
                  <span style={{ ...S.scoreCardNum, color: "#e879f9" }}>{hrAvg}</span>
                  <span style={S.scoreCardSub}>/10</span>
                  <span style={{ fontSize: 12, color: "rgba(245,243,255,0.4)", marginTop: 4 }}>Behavioural</span>
                </div>
                <div style={S.scoreCard}>
                  <span style={S.scoreCardLabel}>Technical</span>
                  <span style={{ ...S.scoreCardNum, color: "#a78bfa" }}>{techAvg}</span>
                  <span style={S.scoreCardSub}>/10</span>
                  <span style={{ fontSize: 12, color: "rgba(245,243,255,0.4)", marginTop: 4 }}>Knowledge</span>
                </div>
              </div>
            </div>

            {/* Result cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 28 }}>
              {results.map((r, i) => (
                <div key={i} style={{ ...S.resCard, borderColor: r.type === "HR" ? "rgba(232,121,249,0.15)" : "rgba(167,139,250,0.15)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 10 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "rgba(245,243,255,0.35)" }}>Q{i + 1}</span>
                      <span style={{ ...S.typeTag, background: r.type === "HR" ? "rgba(232,121,249,0.1)" : "rgba(167,139,250,0.1)", color: r.type === "HR" ? "#e879f9" : "#a78bfa" }}>{r.type}</span>
                    </div>
                    <span style={{ ...S.scorePill, background: r.score >= 7 ? "rgba(167,139,250,0.15)" : r.score >= 5 ? "rgba(232,121,249,0.12)" : "rgba(244,114,182,0.12)", color: r.score >= 7 ? "#c4b5fd" : r.score >= 5 ? "#e879f9" : "#f472b6" }}>
                      {r.score}/10 · {r.communication}
                    </span>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#f5f3ff", margin: "0 0 8px", lineHeight: 1.5 }}>{r.question}</p>
                  <p style={{ fontSize: 13, color: "rgba(245,243,255,0.6)", lineHeight: 1.7, margin: "0 0 10px" }}>{r.feedback}</p>
                  {r.missing_points?.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(245,243,255,0.3)", textTransform: "uppercase", marginBottom: 8 }}>Missing Points</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {r.missing_points.map((mp, j) => (
                          <span key={j} style={{ fontSize: 12, color: "#e879f9", background: "rgba(232,121,249,0.08)", border: "1px solid rgba(232,121,249,0.2)", borderRadius: 6, padding: "3px 10px" }}>• {mp}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <details style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10 }}>
                    <summary style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa", cursor: "pointer", letterSpacing: "0.05em", listStyle: "none" }}>✦ View Sample Answer</summary>
                    <p style={{ fontSize: 13, color: "rgba(245,243,255,0.65)", lineHeight: 1.7, marginTop: 10, paddingLeft: 12, borderLeft: "2px solid rgba(167,139,250,0.3)" }}>{r.sample_answer}</p>
                  </details>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const S = {
  root: {
    minHeight: "100vh",
    background: "#0d0a1a",
    color: "#f5f3ff",
    fontFamily: "'Outfit', 'Segoe UI', sans-serif",
    position: "relative",
    overflowX: "hidden",
    paddingBottom: 60,
  },
  bgOrb1: {
    position: "fixed", top: -180, left: -180, width: 520, height: 520,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)",
    pointerEvents: "none", zIndex: 0,
  },
  bgOrb2: {
    position: "fixed", bottom: -200, right: -200, width: 600, height: 600,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(232,121,249,0.12) 0%, transparent 70%)",
    pointerEvents: "none", zIndex: 0,
  },
  bgOrb3: {
    position: "fixed", top: "40%", left: "60%", width: 300, height: 300,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(167,139,250,0.07) 0%, transparent 70%)",
    pointerEvents: "none", zIndex: 0,
  },
  bgDots: {
    position: "fixed", inset: 0,
    backgroundImage: "radial-gradient(rgba(167,139,250,0.12) 1px, transparent 1px)",
    backgroundSize: "32px 32px",
    pointerEvents: "none", zIndex: 0,
  },
  wrap: {
    position: "relative", zIndex: 1,
    maxWidth: 720, margin: "0 auto", padding: "48px 24px",
  },
  centerCol: {
    display: "flex", flexDirection: "column", alignItems: "center",
    textAlign: "center", paddingTop: 32, gap: 0,
  },
  chip: {
    fontSize: 11, fontWeight: 800, letterSpacing: "0.18em",
    color: "#a78bfa",
    background: "rgba(167,139,250,0.12)",
    border: "1px solid rgba(167,139,250,0.25)",
    borderRadius: 100, padding: "6px 18px", marginBottom: 28, display: "inline-block",
  },
  hero: {
    fontSize: "clamp(44px, 9vw, 76px)", fontWeight: 900,
    lineHeight: 1.05, letterSpacing: "-0.03em",
    color: "#f5f3ff", margin: "0 0 20px",
  },
  heroGrad: {
    background: "linear-gradient(135deg, #a78bfa 0%, #e879f9 50%, #c4b5fd 100%)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  heroSub: {
    fontSize: 17, color: "rgba(245,243,255,0.55)", lineHeight: 1.7,
    maxWidth: 460, margin: "0 0 28px",
  },
  tags: {
    display: "flex", flexWrap: "wrap", gap: 8,
    justifyContent: "center", marginBottom: 36,
  },
  tag: {
    fontSize: 12, fontWeight: 600, color: "rgba(245,243,255,0.6)",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(167,139,250,0.2)",
    borderRadius: 100, padding: "5px 14px",
  },
  btnPrimary: {
    background: "linear-gradient(135deg, #7c3aed, #a855f7, #c026d3)",
    color: "white", border: "none", borderRadius: 14,
    padding: "15px 32px", fontSize: 15, fontWeight: 700,
    cursor: "pointer", letterSpacing: "0.01em",
    transition: "transform 0.15s, box-shadow 0.15s",
    boxShadow: "0 4px 24px rgba(124,58,237,0.35)",
    display: "block", width: "100%",
  },
  btnSecondary: {
    background: "rgba(255,255,255,0.05)",
    color: "#f5f3ff", border: "1px solid rgba(167,139,250,0.2)",
    borderRadius: 14, padding: "15px 32px",
    fontSize: 15, fontWeight: 600, cursor: "pointer",
  },
  backBtn: {
    background: "none", border: "none",
    color: "rgba(245,243,255,0.4)", fontSize: 14,
    cursor: "pointer", padding: "0 0 24px",
    display: "block", fontWeight: 500,
  },
  secTitle: {
    fontSize: 32, fontWeight: 900,
    letterSpacing: "-0.025em", margin: "0 0 8px", color: "#f5f3ff",
  },
  secSub: {
    color: "rgba(245,243,255,0.5)", fontSize: 15, margin: "0 0 28px", lineHeight: 1.6,
  },
  roleGrid: {
    display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 12,
  },
  roleCard: {
    display: "flex", flexDirection: "column", alignItems: "flex-start",
    gap: 8, background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(167,139,250,0.15)",
    borderRadius: 18, padding: "20px 20px 16px",
    cursor: "pointer", transition: "all 0.2s", textAlign: "left",
  },
  iHeader: {
    display: "flex", justifyContent: "space-between",
    alignItems: "center", marginBottom: 22, flexWrap: "wrap", gap: 10,
  },
  roleChip: {
    fontSize: 12, fontWeight: 700, color: "rgba(245,243,255,0.6)",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(167,139,250,0.15)",
    borderRadius: 100, padding: "5px 14px",
  },
  roundChip: {
    fontSize: 12, fontWeight: 700, borderRadius: 100, padding: "5px 14px",
  },
  qCard: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid",
    borderRadius: 20, padding: "26px 28px", marginBottom: 18,
  },
  qLabel: {
    fontSize: 11, fontWeight: 800, letterSpacing: "0.15em",
    textTransform: "uppercase", marginBottom: 12,
  },
  qText: {
    fontSize: 18, fontWeight: 700, lineHeight: 1.55,
    color: "#f5f3ff", margin: 0,
  },
  ansLabel: {
    fontSize: 11, fontWeight: 800, letterSpacing: "0.1em",
    color: "rgba(245,243,255,0.4)", textTransform: "uppercase",
  },
  timerBtn: {
    background: "rgba(167,139,250,0.1)",
    border: "1px solid rgba(167,139,250,0.25)",
    color: "#c4b5fd", borderRadius: 8,
    padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer",
  },
  textarea: {
    width: "100%", background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(167,139,250,0.2)",
    borderRadius: 16, padding: "16px 18px",
    fontSize: 15, color: "#f5f3ff", resize: "vertical",
    fontFamily: "inherit", lineHeight: 1.65, outline: "none",
    boxSizing: "border-box",
  },
  prevBox: {
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(167,139,250,0.1)",
    borderRadius: 16, padding: "16px 20px",
  },
  prevTitle: {
    fontSize: 11, fontWeight: 800, letterSpacing: "0.12em",
    color: "rgba(245,243,255,0.3)", textTransform: "uppercase", marginBottom: 10,
  },
  prevRow: {
    display: "flex", justifyContent: "space-between",
    alignItems: "center", padding: "8px 0",
    borderBottom: "1px solid rgba(255,255,255,0.05)", gap: 10,
  },
  typeTag: {
    fontSize: 10, fontWeight: 800, letterSpacing: "0.1em",
    textTransform: "uppercase", borderRadius: 6, padding: "2px 8px",
    whiteSpace: "nowrap",
  },
  scorePill: {
    fontSize: 12, fontWeight: 700,
    padding: "3px 10px", borderRadius: 100, whiteSpace: "nowrap",
  },
  reportTop: {
    textAlign: "center", marginBottom: 32,
    paddingBottom: 28, borderBottom: "1px solid rgba(167,139,250,0.12)",
  },
  scoreCards: {
    display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12, marginTop: 24,
  },
  scoreCard: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(167,139,250,0.15)",
    borderRadius: 18, padding: "20px 16px",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
  },
  scoreCardLabel: {
    fontSize: 11, fontWeight: 800, letterSpacing: "0.12em",
    color: "rgba(245,243,255,0.35)", textTransform: "uppercase", marginBottom: 6,
  },
  scoreCardNum: {
    fontSize: 40, fontWeight: 900, lineHeight: 1, fontVariantNumeric: "tabular-nums",
  },
  scoreCardSub: {
    fontSize: 14, color: "rgba(245,243,255,0.3)", fontWeight: 600,
  },
  resCard: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid",
    borderRadius: 20, padding: "22px 24px",
  },
};