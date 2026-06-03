import React, { useState, useEffect } from "react";

// ── 全域色彩系統 ──────────────────────────────────────────────
const C = {
  bg: "#0d1f17",
  bgCard: "#132a1e",
  bgCard2: "#1a3828",
  green: "#2ecc8a",
  greenDark: "#1a8c5e",
  greenLight: "#4fffb0",
  red: "#ff5a7e",
  amber: "#ffb347",
  blue: "#5ab4ff",
  text: "#e8f5ef",
  textMuted: "#7aaa90",
  border: "rgba(46,204,138,0.15)",
  borderBright: "rgba(46,204,138,0.35)",
};

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700&family=DM+Serif+Display&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${C.bg}; color: ${C.text}; font-family: 'Noto Sans TC', sans-serif; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: ${C.bg}; }
  ::-webkit-scrollbar-thumb { background: ${C.greenDark}; border-radius: 2px; }

  @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.7;transform:scale(0.95)} }
  @keyframes fadeIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes ecg {
    0%{stroke-dashoffset:300} 100%{stroke-dashoffset:0}
  }
  @keyframes shimmer {
    0%{background-position:-200% 0} 100%{background-position:200% 0}
  }
  .fade-in { animation: fadeIn 0.4s ease forwards; }
  .pulse-dot { animation: pulse 2s infinite; }

  .tab-bar {
    position: fixed; bottom: 0; left: 0; right: 0;
    background: ${C.bgCard};
    border-top: 1px solid ${C.border};
    display: flex; z-index: 100;
    padding-bottom: env(safe-area-inset-bottom);
  }
  .tab-btn {
    flex: 1; padding: 10px 4px 8px;
    background: none; border: none; cursor: pointer;
    display: flex; flex-direction: column; align-items: center; gap: 3px;
    color: ${C.textMuted}; font-size: 10px; font-family: 'Noto Sans TC', sans-serif;
    transition: color 0.2s;
  }
  .tab-btn.active { color: ${C.green}; }
  .tab-btn svg { width: 22px; height: 22px; }

  .card {
    background: ${C.bgCard};
    border: 1px solid ${C.border};
    border-radius: 16px;
    padding: 16px;
    margin-bottom: 12px;
  }
  .card-title {
    font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase;
    color: ${C.textMuted}; margin-bottom: 12px; font-weight: 500;
  }
  .metric-row {
    display: flex; align-items: baseline; gap: 6px;
  }
  .metric-value {
    font-family: 'DM Serif Display', serif;
    font-size: 32px; color: ${C.text}; line-height: 1;
  }
  .metric-unit { font-size: 13px; color: ${C.textMuted}; }
  .metric-age { font-size: 11px; color: ${C.textMuted}; margin-left: auto; }

  .status-chip {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 10px; border-radius: 20px;
    font-size: 11px; font-weight: 500;
  }
  .status-ok { background: rgba(46,204,138,0.15); color: ${C.green}; }
  .status-warn { background: rgba(255,179,71,0.15); color: ${C.amber}; }
  .status-alert { background: rgba(255,90,126,0.15); color: ${C.red}; }

  .input-field {
    width: 100%; background: ${C.bg};
    border: 1px solid ${C.border}; border-radius: 10px;
    padding: 12px 14px; color: ${C.text};
    font-family: 'Noto Sans TC', sans-serif; font-size: 15px;
    outline: none; transition: border-color 0.2s;
  }
  .input-field:focus { border-color: ${C.green}; }
  .input-field::placeholder { color: ${C.textMuted}; }

  .btn-primary {
    width: 100%; padding: 14px;
    background: linear-gradient(135deg, ${C.green}, ${C.greenDark});
    border: none; border-radius: 12px; color: #0d1f17;
    font-weight: 700; font-size: 15px; cursor: pointer;
    font-family: 'Noto Sans TC', sans-serif;
    transition: opacity 0.2s, transform 0.1s;
  }
  .btn-primary:active { opacity: 0.85; transform: scale(0.98); }

  .btn-secondary {
    padding: 10px 20px;
    background: ${C.bgCard2}; border: 1px solid ${C.borderBright};
    border-radius: 10px; color: ${C.green};
    font-size: 13px; cursor: pointer;
    font-family: 'Noto Sans TC', sans-serif;
    transition: background 0.2s;
  }
  .btn-secondary:active { background: ${C.bgCard}; }

  .reminder-item {
    display: flex; align-items: center; gap: 12px;
    padding: 10px 0; border-bottom: 1px solid ${C.border};
  }
  .reminder-item:last-child { border-bottom: none; }

  .section-header {
    font-size: 20px; font-weight: 700; color: ${C.text};
    margin-bottom: 16px; display: flex; align-items: center; gap: 10px;
  }

  .trend-mini {
    display: flex; gap: 3px; align-items: flex-end; height: 32px;
  }
  .trend-bar {
    width: 6px; border-radius: 3px;
    background: linear-gradient(to top, ${C.greenDark}, ${C.green});
    transition: height 0.3s ease;
  }

  .ai-bubble {
    background: linear-gradient(135deg, rgba(46,204,138,0.1), rgba(26,140,94,0.05));
    border: 1px solid ${C.borderBright};
    border-radius: 16px; padding: 16px;
    position: relative; overflow: hidden;
  }
  .ai-bubble::before {
    content: ''; position: absolute; top: 0; left: -100%;
    width: 60%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(46,204,138,0.05), transparent);
    animation: shimmer 3s infinite;
  }

  .knowledge-card {
    background: ${C.bgCard2}; border-radius: 12px;
    padding: 14px; margin-bottom: 10px;
    border-left: 3px solid ${C.green};
    cursor: pointer;
  }
  .knowledge-card:active { opacity: 0.8; }

  select.input-field { appearance: none; }

  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }

  .time-btn {
    padding: 8px; border-radius: 8px; text-align: center;
    font-size: 12px; cursor: pointer; border: 1px solid ${C.border};
    background: ${C.bg}; color: ${C.textMuted};
    font-family: 'Noto Sans TC', sans-serif; transition: all 0.2s;
  }
  .time-btn.selected {
    background: rgba(46,204,138,0.15);
    border-color: ${C.green}; color: ${C.green};
  }
`;

// ── ICON SVG ──────────────────────────────────────────────────
const ShieldIcon = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
    <defs>
      <linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#2ecc8a"/>
        <stop offset="100%" stopColor="#1a6b4a"/>
      </linearGradient>
    </defs>
    <path d="M256 40L400 100L400 250C400 330 330 395 256 420C182 395 112 330 112 250L112 100Z" fill="url(#sg)"/>
    <path d="M185 250C185 222 200 208 215 208C226 208 236 215 244 226C252 215 262 208 273 208C288 208 303 222 303 250C303 290 256 320 256 320C256 320 209 290 185 250Z" fill="#ff5a7e"/>
    <polyline points="145,248 178,248 192,222 208,274 222,238 244,248 256,248 270,228 284,264 298,248 340,248" stroke="white" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);

// ── Tab Icons ─────────────────────────────────────────────────
const HomeIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const TrendIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
const RecordIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>;
const AIIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 110 20A10 10 0 0112 2z"/><path d="M9 9h.01M15 9h.01M9.5 15a4 4 0 005 0"/></svg>;
const BookIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>;

// ── 模擬資料 ──────────────────────────────────────────────────
const MOCK_DATA = {
  profile: { name: "張文彬", age: 55, t2dFamily: true },
  latest: {
    glucose: { value: 104, unit: "mg/dL", date: "今天 07:30", timePoint: "空腹", status: "warn" },
    bp: { sys: 118, dia: 76, pulse: 72, date: "3天前", status: "ok" },
    weight: { value: 75.2, unit: "kg", date: "昨天", status: "ok" },
    hba1c: { value: 5.8, unit: "%", date: "14天前", status: "warn" },
  },
  reminders: [
    { id: 1, title: "洗牙", icon: "🦷", nextDate: "2026/06/03", overdue: true },
    { id: 2, title: "HbA1c追蹤", icon: "🩸", nextDate: "2026/08/27", overdue: false },
    { id: 3, title: "腎功能追蹤", icon: "🫘", nextDate: "2026/11/27", overdue: false },
    { id: 4, title: "眼底檢查", icon: "👁️", nextDate: "2027/05/27", overdue: false },
  ],
  glucoseWeek: [98, 102, 107, 99, 104, 101, 104],
  bpWeek: [{ s: 116, d: 74 }, { s: 120, d: 78 }, { s: 118, d: 76 }, { s: 115, d: 73 }, { s: 119, d: 77 }, { s: 117, d: 75 }, { s: 118, d: 76 }],
  labHistory: [
    { date: "2026/05/27", hospital: "台灣新陳代謝科", hba1c: 5.8, glucose: 104, alt: 45, hdl: 38.5, ldl: 50.1, uricAcid: 5.4, creatinine: 0.84 },
    { date: "2025/11/15", hospital: "台灣新陳代謝科", hba1c: 5.7, glucose: 101, alt: 42, hdl: 39.2, ldl: 55.3, uricAcid: 5.1, creatinine: 0.82 },
    { date: "2025/05/20", hospital: "越南醫院", hba1c: 5.6, glucose: 98, alt: 38, hdl: 41.0, ldl: 58.0, uricAcid: 4.9, creatinine: 0.80 },
  ],
};

const KNOWLEDGE_ITEMS = [
  { key: "hba1c", title: "HbA1c 糖化血色素", icon: "🩸", color: C.red,
    desc: "反映過去3個月的平均血糖水準，是診斷糖尿病前期的黃金指標。",
    levels: [
      { label: "正常", range: "< 5.7%", color: C.green },
      { label: "前期⚠️", range: "5.7–6.4%", color: C.amber },
      { label: "糖尿病", range: "≥ 6.5%", color: C.red },
    ],
    yourValue: "5.8%", yourStatus: "warn",
    tips: ["每3個月追蹤一次", "減少精緻碳水化合物攝取", "飯後30分鐘步行15分鐘", "體重每減1kg，HbA1c約降0.1%"]
  },
  { key: "glucose", title: "空腹血糖 Glucose AC", icon: "🍬", color: C.amber,
    desc: "空腹8小時後的血糖值，反映基礎胰島素功能。",
    levels: [
      { label: "正常", range: "70–99 mg/dL", color: C.green },
      { label: "前期⚠️", range: "100–125 mg/dL", color: C.amber },
      { label: "糖尿病", range: "≥ 126 mg/dL", color: C.red },
    ],
    yourValue: "104 mg/dL", yourStatus: "warn",
    tips: ["晚餐後不吃宵夜", "避免含糖飲料", "規律有氧運動可改善胰島素敏感性"]
  },
  { key: "alt", title: "ALT 肝功能指標", icon: "🫀", color: C.amber,
    desc: "肝細胞損傷的敏感指標，輕微偏高常見於脂肪肝。",
    levels: [
      { label: "正常", range: "4–44 U/L", color: C.green },
      { label: "輕微偏高", range: "45–80 U/L", color: C.amber },
      { label: "明顯偏高", range: "> 80 U/L", color: C.red },
    ],
    yourValue: "45 U/L", yourStatus: "warn",
    tips: ["戒酒或減少飲酒", "減重可顯著改善脂肪肝", "避免過量保健品或藥物", "多吃十字花科蔬菜"]
  },
  { key: "hdl", title: "HDL 好膽固醇", icon: "💚", color: C.green,
    desc: "將多餘膽固醇運回肝臟代謝，數值越高越好，保護心血管。",
    levels: [
      { label: "理想(男)", range: "> 40 mg/dL", color: C.green },
      { label: "偏低⚠️", range: "< 40 mg/dL", color: C.amber },
    ],
    yourValue: "38.5 mg/dL", yourStatus: "warn",
    tips: ["規律有氧運動是提升HDL最有效方法", "戒菸", "攝取健康脂肪（橄欖油、堅果）", "減少反式脂肪"]
  },
  { key: "uricAcid", title: "尿酸 Uric Acid", icon: "🔬", color: C.blue,
    desc: "嘌呤代謝產物，過高會沉積在關節引起痛風，也與腎功能相關。",
    levels: [
      { label: "正常(男)", range: "4.4–7.6 mg/dL", color: C.green },
      { label: "偏高", range: "> 7.6 mg/dL", color: C.amber },
    ],
    yourValue: "5.4 mg/dL", yourStatus: "ok",
    tips: ["多喝水（每天≥2000ml）", "限制內臟、海鮮攝取", "避免啤酒和含糖飲料", "維持健康體重"]
  },
];

// ── 主 APP ────────────────────────────────────────────────────
export default function HealthJournal() {
  const [tab, setTab] = useState("home");
  const [recordTab, setRecordTab] = useState("glucose");
  const [selectedKnowledge, setSelectedKnowledge] = useState(null);
  const [trendItem, setTrendItem] = useState("glucose");
  const [showAddReminder, setShowAddReminder] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReport, setAiReport] = useState(null);
  const [apiKey, setApiKey] = useState(localStorage.getItem("hj_apikey") || "");
  const [showApiInput, setShowApiInput] = useState(false);

  // 記錄表單狀態
  const [glucoseForm, setGlucoseForm] = useState({ value: "", timePoint: "空腹", note: "" });
  const [bpForm, setBpForm] = useState({ sys: "", dia: "", pulse: "" });
  const [weightForm, setWeightForm] = useState({ value: "" });
  const [savedMsg, setSavedMsg] = useState("");

  const showSaved = (msg = "✅ 已儲存") => {
    setSavedMsg(msg);
    setTimeout(() => setSavedMsg(""), 2000);
  };

  const generateAIReport = async () => {
    if (!apiKey) { setShowApiInput(true); return; }
    setAiLoading(true);
    try {
      const prompt = `你是一位專業的個人健康顧問。以下是病患的健康資料，請用繁體中文提供詳細的週報分析：

病患資料：
- 姓名：張文彬，55歲男性
- 家族史：父親有第二型糖尿病（T2D）
- 目前在越南工作，三餐由公司廚房提供

最新檢驗數值（2026/05/27）：
- HbA1c：5.8%（前期範圍5.7-6.4%）
- 空腹血糖：104 mg/dL（前期範圍100-125）
- ALT：45 U/L（略高，正常4-44）
- HDL-C：38.5 mg/dL（偏低，男性應>40）
- LDL-C：50.1 mg/dL（正常）
- 尿酸：5.4 mg/dL（正常）
- 肌酸酐：0.84 mg/dL（正常）
- UPCR：76.40 mg/g（需追蹤）
- TSH：1.979 uIU/mL（正常）
- 本週空腹血糖趨勢：98, 102, 107, 99, 104, 101, 104 mg/dL

請提供：
1. 本週健康總評（100字內）
2. 三大重點關注項目（每項說明原因和趨勢）
3. 針對糖尿病前期的具體飲食建議（3-4點）
4. 本週運動建議（具體類型和時間）
5. 下次追蹤重點
6. 一句鼓勵的話

格式請用清晰的段落，不要使用markdown符號。`;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }]
        })
      });
      const data = await res.json();
      const text = data.content?.map(b => b.text || "").join("") || "無法取得分析結果";
      setAiReport(text);
    } catch (e) {
      setAiReport("分析失敗，請檢查API金鑰是否正確。");
    }
    setAiLoading(false);
  };

  // ── 首頁 ───────────────────────────────────────────────────
  const HomeTab = () => {
    const { latest, reminders, profile } = MOCK_DATA;
    const overdueCount = reminders.filter(r => r.overdue).length;

    return (
      <div className="fade-in" style={{ padding: "16px 16px 80px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ShieldIcon size={36} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>我的健康日誌</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>
                {new Date().toLocaleDateString("zh-TW", { month: "long", day: "numeric", weekday: "short" })}
              </div>
            </div>
          </div>
          {overdueCount > 0 && (
            <div style={{ background: C.red, borderRadius: 20, padding: "4px 10px", fontSize: 12, color: "white" }}>
              {overdueCount} 項到期
            </div>
          )}
        </div>

        {/* 風險提示 */}
        <div style={{ background: "rgba(255,179,71,0.1)", border: `1px solid rgba(255,179,71,0.3)`, borderRadius: 12, padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.amber }}>糖尿病前期 + 家族史 T2D</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>HbA1c 5.8% · 需積極管理</div>
          </div>
        </div>

        {/* 今日數值一覽 */}
        <div className="card-title" style={{ color: C.textMuted, fontSize: 11, letterSpacing: 2, marginBottom: 8 }}>TODAY'S SNAPSHOT</div>

        <div className="grid-2">
          {/* 血糖 */}
          <div className="card" style={{ cursor: "pointer" }} onClick={() => { setTab("trend"); setTrendItem("glucose"); }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>🩸 血糖</div>
            <div className="metric-row">
              <span className="metric-value" style={{ fontSize: 28, color: C.amber }}>{latest.glucose.value}</span>
              <span className="metric-unit">mg/dL</span>
            </div>
            <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>{latest.glucose.timePoint} · {latest.glucose.date}</div>
            <MiniTrendBars data={MOCK_DATA.glucoseWeek} color={C.amber} />
          </div>

          {/* 血壓 */}
          <div className="card" style={{ cursor: "pointer" }} onClick={() => { setTab("trend"); setTrendItem("bp"); }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>💓 血壓</div>
            <div className="metric-row">
              <span className="metric-value" style={{ fontSize: 24, color: C.green }}>{latest.bp.sys}</span>
              <span className="metric-unit">/{latest.bp.dia}</span>
            </div>
            <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>mmHg · {latest.bp.date}</div>
            <div style={{ marginTop: 8 }}><span className="status-chip status-ok">正常</span></div>
          </div>

          {/* 體重 */}
          <div className="card" style={{ cursor: "pointer" }} onClick={() => { setTab("trend"); setTrendItem("weight"); }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>⚖️ 體重</div>
            <div className="metric-row">
              <span className="metric-value" style={{ fontSize: 28 }}>{latest.weight.value}</span>
              <span className="metric-unit">kg</span>
            </div>
            <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>{latest.weight.date}</div>
            <div style={{ marginTop: 8 }}><span className="status-chip status-ok">正常範圍</span></div>
          </div>

          {/* HbA1c */}
          <div className="card" style={{ cursor: "pointer" }} onClick={() => setSelectedKnowledge(KNOWLEDGE_ITEMS[0])}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>📊 HbA1c</div>
            <div className="metric-row">
              <span className="metric-value" style={{ fontSize: 28, color: C.amber }}>{latest.hba1c.value}</span>
              <span className="metric-unit">%</span>
            </div>
            <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>{latest.hba1c.date}</div>
            <div style={{ marginTop: 8 }}><span className="status-chip status-warn">前期範圍</span></div>
          </div>
        </div>

        {/* 今日待記錄 */}
        <div className="card">
          <div className="card-title">今日待記錄</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { label: "午餐", icon: "🍱", done: false },
              { label: "晚餐", icon: "🍽️", done: false },
              { label: "血糖(飯後)", icon: "🩸", done: false },
              { label: "運動", icon: "🏃", done: false },
            ].map(item => (
              <div key={item.label}
                onClick={() => setTab("record")}
                style={{
                  background: item.done ? "rgba(46,204,138,0.15)" : C.bg,
                  border: `1px solid ${item.done ? C.green : C.border}`,
                  borderRadius: 10, padding: "8px 12px",
                  fontSize: 12, color: item.done ? C.green : C.textMuted,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 6
                }}>
                {item.icon} {item.label}
              </div>
            ))}
          </div>
        </div>

        {/* 健康提醒 */}
        <div className="card">
          <div className="card-title">定期健康提醒</div>
          {reminders.map(r => (
            <div key={r.id} className="reminder-item">
              <span style={{ fontSize: 22 }}>{r.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{r.title}</div>
                <div style={{ fontSize: 11, color: C.textMuted }}>下次：{r.nextDate}</div>
              </div>
              <span className={`status-chip ${r.overdue ? "status-alert" : "status-ok"}`}>
                {r.overdue ? "今天到期！" : "待追蹤"}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ── 趨勢圖 ────────────────────────────────────────────────
  const TrendTab = () => {
    const days = ["週一", "週二", "週三", "週四", "週五", "週六", "週日"];
    const glucoseData = MOCK_DATA.glucoseWeek;
    const maxG = Math.max(...glucoseData);
    const minG = Math.min(...glucoseData);

    const labItems = [
      { key: "hba1c", label: "HbA1c", unit: "%", color: C.amber, data: MOCK_DATA.labHistory.map(l => l.hba1c), ref: "4–6" },
      { key: "alt", label: "ALT", unit: "U/L", color: C.red, data: MOCK_DATA.labHistory.map(l => l.alt), ref: "4–44" },
      { key: "hdl", label: "HDL-C", unit: "mg/dL", color: C.green, data: MOCK_DATA.labHistory.map(l => l.hdl), ref: ">40(男)" },
      { key: "ldl", label: "LDL-C", unit: "mg/dL", color: C.blue, data: MOCK_DATA.labHistory.map(l => l.ldl), ref: "<130" },
    ];

    const TREND_ITEMS = [
      { key: "glucose", label: "血糖趨勢" },
      { key: "bp", label: "血壓趨勢" },
      { key: "lab", label: "抽血指標" },
    ];

    return (
      <div className="fade-in" style={{ padding: "16px 16px 80px" }}>
        <div className="section-header">📈 健康趨勢</div>

        {/* 趨勢選擇 */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {TREND_ITEMS.map(t => (
            <button key={t.key}
              className="btn-secondary"
              style={{ flex: 1, padding: "8px 4px", fontSize: 12,
                background: trendItem === t.key ? "rgba(46,204,138,0.2)" : C.bgCard,
                borderColor: trendItem === t.key ? C.green : C.border,
                color: trendItem === t.key ? C.green : C.textMuted
              }}
              onClick={() => setTrendItem(t.key)}>{t.label}</button>
          ))}
        </div>

        {/* 血糖趨勢 */}
        {trendItem === "glucose" && (
          <div className="card">
            <div className="card-title">本週空腹血糖</div>
            <SimpleLineChart
              data={glucoseData} labels={days}
              color={C.amber} unit="mg/dL"
              refLines={[{ value: 100, label: "前期線", color: C.amber }, { value: 126, label: "糖尿病線", color: C.red }]}
              min={90} max={130}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, color: C.textMuted }}>最低</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.green }}>{minG}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, color: C.textMuted }}>平均</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.amber }}>
                  {Math.round(glucoseData.reduce((a, b) => a + b, 0) / glucoseData.length)}
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, color: C.textMuted }}>最高</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.red }}>{maxG}</div>
              </div>
            </div>
          </div>
        )}

        {/* 血壓趨勢 */}
        {trendItem === "bp" && (
          <div className="card">
            <div className="card-title">本週血壓</div>
            <SimpleLineChart
              data={MOCK_DATA.bpWeek.map(b => b.s)}
              data2={MOCK_DATA.bpWeek.map(b => b.d)}
              labels={days}
              color={C.green} color2={C.blue}
              unit="mmHg" label1="收縮壓" label2="舒張壓"
              refLines={[{ value: 130, label: "高血壓線", color: C.amber }]}
              min={60} max={140}
            />
            <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 12, height: 3, background: C.green, borderRadius: 2 }}/>
                <span style={{ fontSize: 11, color: C.textMuted }}>收縮壓</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 12, height: 3, background: C.blue, borderRadius: 2 }}/>
                <span style={{ fontSize: 11, color: C.textMuted }}>舒張壓</span>
              </div>
            </div>
          </div>
        )}

        {/* 抽血指標趨勢 */}
        {trendItem === "lab" && (
          <>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 12 }}>
              抽血日期：{MOCK_DATA.labHistory.map(l => l.date.slice(5)).join(" → ")}
            </div>
            {labItems.map(item => (
              <div key={item.key} className="card" style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: item.color }}>{item.label}</span>
                  <span style={{ fontSize: 11, color: C.textMuted }}>參考：{item.ref} {item.unit}</span>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 60 }}>
                  {item.data.map((val, i) => {
                    const maxVal = Math.max(...item.data) * 1.2;
                    const h = Math.max(20, (val / maxVal) * 55);
                    return (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <div style={{ fontSize: 11, color: item.color, fontWeight: 700 }}>{val}</div>
                        <div style={{ width: "100%", height: h, background: `linear-gradient(to top, ${item.color}99, ${item.color}44)`, borderRadius: 4, border: `1px solid ${item.color}66` }}/>
                        <div style={{ fontSize: 9, color: C.textMuted }}>{MOCK_DATA.labHistory[i].date.slice(2, 7)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    );
  };

  // ── 記錄 Tab ───────────────────────────────────────────────
  const RecordTab = () => {
    const SUB_TABS = [
      { key: "glucose", label: "🩸血糖" },
      { key: "bp", label: "💓血壓" },
      { key: "weight", label: "⚖️體重" },
      { key: "meal", label: "🍱飲食" },
      { key: "exercise", label: "🏃運動" },
      { key: "lab", label: "📋抽血" },
    ];

    return (
      <div className="fade-in" style={{ padding: "16px 16px 80px" }}>
        <div className="section-header">📝 記錄</div>

        {/* 子Tab */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 16, paddingBottom: 4 }}>
          {SUB_TABS.map(t => (
            <button key={t.key}
              onClick={() => setRecordTab(t.key)}
              style={{
                whiteSpace: "nowrap", padding: "7px 14px", borderRadius: 20,
                border: `1px solid ${recordTab === t.key ? C.green : C.border}`,
                background: recordTab === t.key ? "rgba(46,204,138,0.15)" : C.bg,
                color: recordTab === t.key ? C.green : C.textMuted,
                fontSize: 12, cursor: "pointer",
                fontFamily: "'Noto Sans TC', sans-serif",
              }}>{t.label}</button>
          ))}
        </div>

        {savedMsg && (
          <div style={{ background: "rgba(46,204,138,0.15)", border: `1px solid ${C.green}`, borderRadius: 10, padding: "10px 14px", marginBottom: 12, color: C.green, fontSize: 13, textAlign: "center" }}>
            {savedMsg}
          </div>
        )}

        {/* 血糖記錄 */}
        {recordTab === "glucose" && (
          <div className="card">
            <div className="card-title">記錄血糖</div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>時間點</div>
              <div className="grid-3">
                {["空腹", "飯後2hr", "睡前"].map(tp => (
                  <div key={tp} className={`time-btn ${glucoseForm.timePoint === tp ? "selected" : ""}`}
                    onClick={() => setGlucoseForm(f => ({ ...f, timePoint: tp }))}>{tp}</div>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>血糖值 (mg/dL)</div>
              <input className="input-field" type="number" placeholder="例：104"
                value={glucoseForm.value}
                onChange={e => setGlucoseForm(f => ({ ...f, value: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>備註（可選）</div>
              <input className="input-field" placeholder="例：飯後運動30分鐘"
                value={glucoseForm.note}
                onChange={e => setGlucoseForm(f => ({ ...f, note: e.target.value }))} />
            </div>
            <button className="btn-primary" onClick={() => { showSaved("✅ 血糖已儲存"); setGlucoseForm({ value: "", timePoint: "空腹", note: "" }); }}>
              儲存
            </button>
          </div>
        )}

        {/* 血壓記錄 */}
        {recordTab === "bp" && (
          <div className="card">
            <div className="card-title">記錄血壓</div>
            <div className="grid-3" style={{ marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>收縮壓</div>
                <input className="input-field" type="number" placeholder="118"
                  value={bpForm.sys} onChange={e => setBpForm(f => ({ ...f, sys: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>舒張壓</div>
                <input className="input-field" type="number" placeholder="76"
                  value={bpForm.dia} onChange={e => setBpForm(f => ({ ...f, dia: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>心率</div>
                <input className="input-field" type="number" placeholder="72"
                  value={bpForm.pulse} onChange={e => setBpForm(f => ({ ...f, pulse: e.target.value }))} />
              </div>
            </div>
            <div style={{ background: C.bg, borderRadius: 10, padding: 10, marginBottom: 14, fontSize: 12, color: C.textMuted }}>
              💡 建議早上起床後、安靜休息5分鐘後量測
            </div>
            <button className="btn-primary" onClick={() => { showSaved("✅ 血壓已儲存"); setBpForm({ sys: "", dia: "", pulse: "" }); }}>
              儲存
            </button>
          </div>
        )}

        {/* 體重記錄 */}
        {recordTab === "weight" && (
          <div className="card">
            <div className="card-title">記錄體重</div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>體重 (kg)</div>
              <input className="input-field" type="number" step="0.1" placeholder="例：75.2"
                value={weightForm.value} onChange={e => setWeightForm({ value: e.target.value })} />
            </div>
            <div style={{ background: C.bg, borderRadius: 10, padding: 10, marginBottom: 14, fontSize: 12, color: C.textMuted }}>
              💡 建議每天早上空腹、上廁所後量測
            </div>
            <button className="btn-primary" onClick={() => { showSaved("✅ 體重已儲存"); setWeightForm({ value: "" }); }}>
              儲存
            </button>
          </div>
        )}

        {/* 飲食記錄 */}
        {recordTab === "meal" && (
          <div className="card">
            <div className="card-title">記錄飲食</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {["早餐", "午餐", "晚餐", "點心"].map(m => (
                <div key={m} style={{
                  flex: 1, textAlign: "center", padding: "10px 4px",
                  background: m === "午餐" ? "rgba(46,204,138,0.15)" : C.bg,
                  border: `1px solid ${m === "午餐" ? C.green : C.border}`,
                  borderRadius: 10, fontSize: 12, color: m === "午餐" ? C.green : C.textMuted, cursor: "pointer"
                }}>{m}</div>
              ))}
            </div>
            <div style={{
              border: `2px dashed ${C.border}`, borderRadius: 12,
              padding: "24px 16px", textAlign: "center", marginBottom: 12, cursor: "pointer"
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📸</div>
              <div style={{ fontSize: 14, color: C.textMuted }}>拍照或上傳餐點圖片</div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>AI 自動分析營養成分</div>
            </div>
            <input className="input-field" placeholder="或輸入食物名稱（例：越南河粉、白飯+雞肉）" style={{ marginBottom: 12 }} />
            <button className="btn-primary" onClick={() => showSaved("✅ 飲食記錄已儲存")}>
              儲存
            </button>
          </div>
        )}

        {/* 運動記錄 */}
        {recordTab === "exercise" && (
          <div className="card">
            <div className="card-title">記錄運動</div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>運動類型</div>
              <div className="grid-3">
                {["走路", "騎車", "游泳", "重訓", "瑜伽", "其他"].map(type => (
                  <div key={type} className="time-btn" style={{ padding: "10px 4px" }}>{type}</div>
                ))}
              </div>
            </div>
            <div className="grid-2" style={{ marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>時長（分鐘）</div>
                <input className="input-field" type="number" placeholder="30" />
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>強度</div>
                <select className="input-field">
                  <option>輕度</option>
                  <option>中度</option>
                  <option>高強度</option>
                </select>
              </div>
            </div>
            <div style={{ background: C.bg, borderRadius: 10, padding: 10, marginBottom: 14, fontSize: 12, color: C.green }}>
              💡 飯後30分鐘走路15分鐘，可降低血糖約10-15 mg/dL
            </div>
            <button className="btn-primary" onClick={() => showSaved("✅ 運動記錄已儲存")}>
              儲存
            </button>
          </div>
        )}

        {/* 抽血報告 */}
        {recordTab === "lab" && (
          <div className="card">
            <div className="card-title">上傳抽血報告</div>
            <div className="grid-2" style={{ marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>醫院</div>
                <input className="input-field" placeholder="台大醫院" />
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>國家</div>
                <select className="input-field">
                  <option>台灣</option>
                  <option>越南</option>
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>抽血日期</div>
              <input className="input-field" type="date" />
            </div>
            <div style={{
              border: `2px dashed ${C.border}`, borderRadius: 12,
              padding: "20px 16px", textAlign: "center", marginBottom: 12, cursor: "pointer"
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
              <div style={{ fontSize: 14, color: C.textMuted }}>拍照上傳報告</div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>AI 自動辨識數值・支援台灣/越南格式</div>
            </div>
            <div style={{ fontSize: 12, color: C.textMuted, textAlign: "center", marginBottom: 12 }}>— 或貼上報告文字 —</div>
            <textarea className="input-field" rows={4} placeholder="將報告文字貼上，AI 自動解析數值..." style={{ resize: "none", marginBottom: 12 }} />
            <button className="btn-primary" onClick={() => showSaved("✅ 報告已儲存，AI正在解析...")}>
              解析並儲存
            </button>
          </div>
        )}
      </div>
    );
  };

  // ── AI 分析 Tab ───────────────────────────────────────────
  const AITab = () => (
    <div className="fade-in" style={{ padding: "16px 16px 80px" }}>
      <div className="section-header">🤖 AI 健康分析</div>

      {showApiInput && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-title">設定 API 金鑰</div>
          <input className="input-field" type="password" placeholder="sk-ant-..."
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            style={{ marginBottom: 10 }} />
          <button className="btn-primary" onClick={() => {
            localStorage.setItem("hj_apikey", apiKey);
            setShowApiInput(false);
            generateAIReport();
          }}>確認並分析</button>
        </div>
      )}

      <div className="ai-bubble" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            background: `linear-gradient(135deg, ${C.green}, ${C.greenDark})`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20
          }}>🤖</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.green }}>Claude AI 健康顧問</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>內建 T2D 家族史背景 · 個人化分析</div>
          </div>
        </div>

        {aiReport ? (
          <div style={{ fontSize: 13, color: C.text, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
            {aiReport}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.7 }}>
            根據你的健康數據、家族史（父親T2D）及生活習慣，AI 將提供個人化週報分析，包含：
            <br/>• 本週健康總評
            <br/>• 重點關注項目
            <br/>• 飲食與運動建議
            <br/>• 下次追蹤提醒
          </div>
        )}
      </div>

      <button className="btn-primary" style={{ marginBottom: 12 }}
        onClick={generateAIReport} disabled={aiLoading}>
        {aiLoading ? "⏳ AI 分析中..." : "🔍 產生本週AI健康週報"}
      </button>

      {/* 快速問AI */}
      <div className="card">
        <div className="card-title">快速問 AI</div>
        <textarea className="input-field" rows={3}
          placeholder="例：我今天血糖107，昨天吃了白飯，是什麼原因？"
          style={{ resize: "none", marginBottom: 10 }} />
        <button className="btn-primary">發問</button>
      </div>

      {/* 風險評估 */}
      <div className="card">
        <div className="card-title">T2D 風險評估</div>
        <div style={{ marginBottom: 12 }}>
          {[
            { label: "HbA1c 5.8%", risk: 70, color: C.amber },
            { label: "空腹血糖 104", risk: 55, color: C.amber },
            { label: "家族史 T2D", risk: 85, color: C.red },
            { label: "HDL偏低", risk: 45, color: C.amber },
            { label: "ALT輕微偏高", risk: 35, color: C.blue },
          ].map(item => (
            <div key={item.label} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: C.text }}>{item.label}</span>
                <span style={{ fontSize: 12, color: item.color }}>{item.risk}%</span>
              </div>
              <div style={{ height: 6, background: C.bg, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${item.risk}%`, background: item.color, borderRadius: 3, transition: "width 0.8s ease" }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: C.textMuted, textAlign: "center" }}>
          ⚠️ 僅供參考，不代表醫療診斷
        </div>
      </div>
    </div>
  );

  // ── 知識庫 Tab ────────────────────────────────────────────
  const KnowledgeTab = () => {
    if (selectedKnowledge) {
      const item = selectedKnowledge;
      return (
        <div className="fade-in" style={{ padding: "16px 16px 80px" }}>
          <button className="btn-secondary" style={{ marginBottom: 16 }}
            onClick={() => setSelectedKnowledge(null)}>← 返回</button>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <span style={{ fontSize: 36 }}>{item.icon}</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: item.color }}>{item.title}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>點擊查看完整說明</div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">是什麼？</div>
            <div style={{ fontSize: 14, color: C.text, lineHeight: 1.7 }}>{item.desc}</div>
          </div>

          <div className="card">
            <div className="card-title">數值範圍</div>
            {item.levels.map(l => (
              <div key={l.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 13, color: C.text }}>{l.label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: l.color }}>{l.range}</span>
              </div>
            ))}
          </div>

          <div className="card" style={{ border: `1px solid ${item.color}44` }}>
            <div className="card-title">你的數值</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 28, fontFamily: "'DM Serif Display', serif", color: item.color }}>{item.yourValue}</span>
              <span className={`status-chip ${item.yourStatus === "ok" ? "status-ok" : "status-warn"}`}>
                {item.yourStatus === "ok" ? "✅ 正常" : "⚠️ 需注意"}
              </span>
            </div>
          </div>

          <div className="card">
            <div className="card-title">改善建議</div>
            {item.tips.map((tip, i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ color: C.green, fontWeight: 700 }}>{i + 1}</span>
                <span style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{tip}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="fade-in" style={{ padding: "16px 16px 80px" }}>
        <div className="section-header">📚 健康知識庫</div>

        {/* 糖尿病前期專區 */}
        <div style={{ background: "rgba(255,179,71,0.08)", border: `1px solid rgba(255,179,71,0.25)`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.amber, marginBottom: 6 }}>📌 糖尿病前期專區（適合你）</div>
          <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.7 }}>
            HbA1c 5.8% + 家族史 T2D = 高風險群。<br/>
            好消息：糖尿病前期是可逆的，透過生活方式改變，有機會恢復正常。
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            {["什麼是糖尿病前期？", "如何逆轉？", "飲食GI值指南", "運動降血糖"].map(t => (
              <div key={t} style={{ padding: "5px 12px", background: "rgba(255,179,71,0.12)", borderRadius: 20, fontSize: 11, color: C.amber, cursor: "pointer" }}>{t}</div>
            ))}
          </div>
        </div>

        {/* 檢驗項目百科 */}
        <div style={{ fontSize: 13, fontWeight: 600, color: C.textMuted, marginBottom: 10, letterSpacing: 1 }}>LABORATORY VALUES</div>
        {KNOWLEDGE_ITEMS.map(item => (
          <div key={item.key} className="knowledge-card"
            style={{ borderLeftColor: item.color }}
            onClick={() => setSelectedKnowledge(item)}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 22 }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{item.title}</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>你的值：{item.yourValue}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className={`status-chip ${item.yourStatus === "ok" ? "status-ok" : "status-warn"}`}>
                  {item.yourStatus === "ok" ? "正常" : "注意"}
                </span>
                <span style={{ color: C.textMuted }}>›</span>
              </div>
            </div>
          </div>
        ))}

        {/* 飲食知識 */}
        <div style={{ fontSize: 13, fontWeight: 600, color: C.textMuted, margin: "16px 0 10px", letterSpacing: 1 }}>NUTRITION</div>
        {[
          { icon: "🍚", title: "GI值指南", desc: "低GI食物對血糖更友善" },
          { icon: "🥗", title: "護肝飲食", desc: "降低ALT的飲食選擇" },
          { icon: "🥑", title: "提升 HDL", desc: "增加好膽固醇的方法" },
        ].map(item => (
          <div key={item.title} className="knowledge-card" style={{ borderLeftColor: C.green }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22 }}>{item.icon}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{item.title}</div>
                <div style={{ fontSize: 11, color: C.textMuted }}>{item.desc}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ── 迷你趨勢條 ────────────────────────────────────────────
  const MiniTrendBars = ({ data, color }) => {
    const max = Math.max(...data);
    return (
      <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 20, marginTop: 8 }}>
        {data.map((v, i) => (
          <div key={i} style={{
            flex: 1, borderRadius: 2,
            height: `${Math.max(20, (v / max) * 100)}%`,
            background: i === data.length - 1 ? color : `${color}55`
          }} />
        ))}
      </div>
    );
  };

  // ── 簡易折線圖 ────────────────────────────────────────────
  const SimpleLineChart = ({ data, data2, labels, color, color2, unit, min = 0, max = 200, refLines = [], label1, label2 }) => {
    const W = 320, H = 120, PAD = 20;
    const range = max - min;
    const toY = v => PAD + (1 - (v - min) / range) * (H - PAD * 2);
    const toX = i => PAD + (i / (data.length - 1)) * (W - PAD * 2);

    const points = data.map((v, i) => `${toX(i)},${toY(v)}`).join(" ");
    const points2 = data2 ? data2.map((v, i) => `${toX(i)},${toY(v)}`).join(" ") : "";

    return (
      <div style={{ overflowX: "auto" }}>
        <svg width="100%" viewBox={`0 0 ${W} ${H + 20}`} style={{ display: "block" }}>
          {/* Grid lines */}
          {[0.25, 0.5, 0.75, 1].map(f => (
            <line key={f} x1={PAD} y1={toY(min + f * range)} x2={W - PAD} y2={toY(min + f * range)}
              stroke={C.border} strokeWidth="1" />
          ))}
          {/* Reference lines */}
          {refLines.map(r => (
            <g key={r.label}>
              <line x1={PAD} y1={toY(r.value)} x2={W - PAD} y2={toY(r.value)}
                stroke={r.color} strokeWidth="1.5" strokeDasharray="4,3" />
              <text x={W - PAD + 2} y={toY(r.value) + 4} fontSize="9" fill={r.color}>{r.value}</text>
            </g>
          ))}
          {/* Lines */}
          <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {data2 && <polyline points={points2} fill="none" stroke={color2} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
          {/* Dots */}
          {data.map((v, i) => (
            <circle key={i} cx={toX(i)} cy={toY(v)} r="4" fill={color} stroke={C.bg} strokeWidth="2" />
          ))}
          {data2 && data2.map((v, i) => (
            <circle key={i} cx={toX(i)} cy={toY(v)} r="4" fill={color2} stroke={C.bg} strokeWidth="2" />
          ))}
          {/* X labels */}
          {labels.map((l, i) => (
            <text key={i} x={toX(i)} y={H + 14} fontSize="9" fill={C.textMuted} textAnchor="middle">{l}</text>
          ))}
          {/* Last value label */}
          <text x={toX(data.length - 1)} y={toY(data[data.length - 1]) - 8} fontSize="11" fill={color} textAnchor="middle" fontWeight="bold">
            {data[data.length - 1]}
          </text>
        </svg>
      </div>
    );
  };

  const TABS = [
    { key: "home", label: "首頁", icon: <HomeIcon /> },
    { key: "trend", label: "趨勢", icon: <TrendIcon /> },
    { key: "record", label: "記錄", icon: <RecordIcon /> },
    { key: "ai", label: "AI分析", icon: <AIIcon /> },
    { key: "knowledge", label: "知識庫", icon: <BookIcon /> },
  ];

  return (
    <>
      <style>{styles}</style>
      <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: C.bg, position: "relative" }}>
        {tab === "home" && <HomeTab />}
        {tab === "trend" && <TrendTab />}
        {tab === "record" && <RecordTab />}
        {tab === "ai" && <AITab />}
        {tab === "knowledge" && <KnowledgeTab />}

        {/* Bottom Tab Bar */}
        <div className="tab-bar">
          {TABS.map(t => (
            <button key={t.key} className={`tab-btn ${tab === t.key ? "active" : ""}`}
              onClick={() => { setTab(t.key); if (t.key !== "knowledge") setSelectedKnowledge(null); }}>
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
