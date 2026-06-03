import React, { useState, useEffect, useCallback } from "react";

// ── 版本 & 後端設定 ───────────────────────────────────────
const VERSION = "v1.1";
const GAS_URL = "https://script.google.com/macros/s/AKfycbzEQmF8JD_QI_Wq4fOpcwkCXKjrKG8ke63wqR8Mfx0IvUeSLxseJUwSncmJhuJpf4cyqw/exec";

// ── API 工具 ──────────────────────────────────────────────
const api = {
  get: async (action, params = {}) => {
    const q = new URLSearchParams({ action, ...params }).toString();
    const res = await fetch(`${GAS_URL}?${q}`);
    return res.json();
  },
  post: async (action, sheet, data) => {
    const res = await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify({ action, sheet, data }),
    });
    return res.json();
  },
};

// ── 全域色彩系統 ──────────────────────────────────────────
const C = {
  bg: "#0d1f17", bgCard: "#132a1e", bgCard2: "#1a3828",
  green: "#2ecc8a", greenDark: "#1a8c5e", greenLight: "#4fffb0",
  red: "#ff5a7e", amber: "#ffb347", blue: "#5ab4ff",
  text: "#e8f5ef", textMuted: "#7aaa90",
  border: "rgba(46,204,138,0.15)", borderBright: "rgba(46,204,138,0.35)",
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
  @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
  @keyframes spin { to{transform:rotate(360deg)} }
  .fade-in { animation: fadeIn 0.4s ease forwards; }
  .spin { animation: spin 1s linear infinite; display:inline-block; }
  .tab-bar {
    position: fixed; bottom: 0; left: 0; right: 0;
    background: ${C.bgCard}; border-top: 1px solid ${C.border};
    display: flex; z-index: 100;
    padding-bottom: env(safe-area-inset-bottom);
  }
  .tab-btn {
    flex: 1; padding: 10px 4px 8px; background: none; border: none; cursor: pointer;
    display: flex; flex-direction: column; align-items: center; gap: 3px;
    color: ${C.textMuted}; font-size: 10px; font-family: 'Noto Sans TC', sans-serif;
    transition: color 0.2s;
  }
  .tab-btn.active { color: ${C.green}; }
  .tab-btn svg { width: 22px; height: 22px; }
  .card { background: ${C.bgCard}; border: 1px solid ${C.border}; border-radius: 16px; padding: 16px; margin-bottom: 12px; }
  .card-title { font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: ${C.textMuted}; margin-bottom: 12px; font-weight: 500; }
  .metric-value { font-family: 'DM Serif Display', serif; font-size: 32px; color: ${C.text}; line-height: 1; }
  .metric-unit { font-size: 13px; color: ${C.textMuted}; }
  .status-chip { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 500; }
  .status-ok { background: rgba(46,204,138,0.15); color: ${C.green}; }
  .status-warn { background: rgba(255,179,71,0.15); color: ${C.amber}; }
  .status-alert { background: rgba(255,90,126,0.15); color: ${C.red}; }
  .input-field { width: 100%; background: ${C.bg}; border: 1px solid ${C.border}; border-radius: 10px; padding: 12px 14px; color: ${C.text}; font-family: 'Noto Sans TC', sans-serif; font-size: 15px; outline: none; transition: border-color 0.2s; }
  .input-field:focus { border-color: ${C.green}; }
  .input-field::placeholder { color: ${C.textMuted}; }
  .btn-primary { width: 100%; padding: 14px; background: linear-gradient(135deg, ${C.green}, ${C.greenDark}); border: none; border-radius: 12px; color: #0d1f17; font-weight: 700; font-size: 15px; cursor: pointer; font-family: 'Noto Sans TC', sans-serif; transition: opacity 0.2s, transform 0.1s; }
  .btn-primary:active { opacity: 0.85; transform: scale(0.98); }
  .btn-primary:disabled { opacity: 0.5; }
  .btn-secondary { padding: 10px 20px; background: ${C.bgCard2}; border: 1px solid ${C.borderBright}; border-radius: 10px; color: ${C.green}; font-size: 13px; cursor: pointer; font-family: 'Noto Sans TC', sans-serif; transition: background 0.2s; }
  .reminder-item { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid ${C.border}; }
  .reminder-item:last-child { border-bottom: none; }
  .section-header { font-size: 20px; font-weight: 700; color: ${C.text}; margin-bottom: 16px; display: flex; align-items: center; gap: 10px; }
  .ai-bubble { background: linear-gradient(135deg, rgba(46,204,138,0.1), rgba(26,140,94,0.05)); border: 1px solid ${C.borderBright}; border-radius: 16px; padding: 16px; position: relative; overflow: hidden; }
  .knowledge-card { background: ${C.bgCard2}; border-radius: 12px; padding: 14px; margin-bottom: 10px; border-left: 3px solid ${C.green}; cursor: pointer; }
  select.input-field { appearance: none; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
  .time-btn { padding: 8px; border-radius: 8px; text-align: center; font-size: 12px; cursor: pointer; border: 1px solid ${C.border}; background: ${C.bg}; color: ${C.textMuted}; font-family: 'Noto Sans TC', sans-serif; transition: all 0.2s; }
  .time-btn.selected { background: rgba(46,204,138,0.15); border-color: ${C.green}; color: ${C.green}; }
  .save-toast { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: ${C.green}; color: #0d1f17; padding: 10px 24px; border-radius: 20px; font-weight: 700; font-size: 14px; z-index: 999; animation: fadeIn 0.3s ease; }
`;

// ── Icons ─────────────────────────────────────────────────
const ShieldIcon = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
    <defs>
      <linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#2ecc8a"/><stop offset="100%" stopColor="#1a6b4a"/>
      </linearGradient>
    </defs>
    <path d="M256 40L400 100L400 250C400 330 330 395 256 420C182 395 112 330 112 250L112 100Z" fill="url(#sg)"/>
    <path d="M185 250C185 222 200 208 215 208C226 208 236 215 244 226C252 215 262 208 273 208C288 208 303 222 303 250C303 290 256 320 256 320C256 320 209 290 185 250Z" fill="#ff5a7e"/>
    <polyline points="145,248 178,248 192,222 208,274 222,238 244,248 256,248 270,228 284,264 298,248 340,248" stroke="white" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);
const HomeIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const TrendIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
const RecordIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>;
const AIIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 110 20A10 10 0 0112 2z"/><path d="M9 9h.01M15 9h.01M9.5 15a4 4 0 005 0"/></svg>;
const BookIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>;

// ── 知識庫資料 ────────────────────────────────────────────
const KNOWLEDGE_ITEMS = [
  { key:"hba1c", title:"HbA1c 糖化血色素", icon:"🩸", color:C.red,
    desc:"反映過去3個月的平均血糖水準，是診斷糖尿病前期的黃金指標。",
    levels:[{label:"正常",range:"< 5.7%",color:C.green},{label:"前期⚠️",range:"5.7–6.4%",color:C.amber},{label:"糖尿病",range:"≥ 6.5%",color:C.red}],
    yourValue:"5.8%", yourStatus:"warn",
    tips:["每3個月追蹤一次","減少精緻碳水化合物攝取","飯後30分鐘步行15分鐘","體重每減1kg，HbA1c約降0.1%"]},
  { key:"glucose", title:"空腹血糖 Glucose AC", icon:"🍬", color:C.amber,
    desc:"空腹8小時後的血糖值，反映基礎胰島素功能。",
    levels:[{label:"正常",range:"70–99 mg/dL",color:C.green},{label:"前期⚠️",range:"100–125 mg/dL",color:C.amber},{label:"糖尿病",range:"≥ 126 mg/dL",color:C.red}],
    yourValue:"104 mg/dL", yourStatus:"warn",
    tips:["晚餐後不吃宵夜","避免含糖飲料","規律有氧運動可改善胰島素敏感性"]},
  { key:"alt", title:"ALT 肝功能指標", icon:"🫀", color:C.amber,
    desc:"肝細胞損傷的敏感指標，輕微偏高常見於脂肪肝。",
    levels:[{label:"正常",range:"4–44 U/L",color:C.green},{label:"輕微偏高",range:"45–80 U/L",color:C.amber},{label:"明顯偏高",range:"> 80 U/L",color:C.red}],
    yourValue:"45 U/L", yourStatus:"warn",
    tips:["減重可顯著改善脂肪肝","避免過量保健品","多吃十字花科蔬菜"]},
  { key:"hdl", title:"HDL 好膽固醇", icon:"💚", color:C.green,
    desc:"將多餘膽固醇運回肝臟代謝，數值越高越好。",
    levels:[{label:"理想(男)",range:"> 40 mg/dL",color:C.green},{label:"偏低⚠️",range:"< 40 mg/dL",color:C.amber}],
    yourValue:"38.5 mg/dL", yourStatus:"warn",
    tips:["規律有氧運動是提升HDL最有效方法","攝取健康脂肪（橄欖油、堅果）","減少反式脂肪"]},
  { key:"uricAcid", title:"尿酸 Uric Acid", icon:"🔬", color:C.blue,
    desc:"嘌呤代謝產物，過高會沉積在關節引起痛風。",
    levels:[{label:"正常(男)",range:"4.4–7.6 mg/dL",color:C.green},{label:"偏高",range:"> 7.6 mg/dL",color:C.amber}],
    yourValue:"5.4 mg/dL", yourStatus:"ok",
    tips:["多喝水（每天≥2000ml）","限制內臟、海鮮攝取","避免啤酒和含糖飲料"]},
];

// ── 主 APP ────────────────────────────────────────────────
export default function HealthJournal() {
  const [tab, setTab] = useState("home");
  const [recordTab, setRecordTab] = useState("glucose");
  const [selectedKnowledge, setSelectedKnowledge] = useState(null);
  const [trendItem, setTrendItem] = useState("glucose");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReport, setAiReport] = useState(null);
  const [apiKey, setApiKey] = useState(localStorage.getItem("hj_apikey") || "");
  const [showApiInput, setShowApiInput] = useState(false);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);

  // 後端資料
  const [summary, setSummary] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [labHistory, setLabHistory] = useState([]);
  const [glucoseHistory, setGlucoseHistory] = useState([]);
  const [bpHistory, setBpHistory] = useState([]);

  // 表單
  const [glucoseForm, setGlucoseForm] = useState({ value:"", timePoint:"空腹", note:"" });
  const [bpForm, setBpForm] = useState({ sys:"", dia:"", pulse:"" });
  const [weightForm, setWeightForm] = useState({ value:"" });

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  // 載入資料
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sum, rem, lab, glu, bp] = await Promise.all([
        api.get("getSummary"),
        api.get("getReminders"),
        api.get("getLabHistory"),
        api.get("getAll", { sheet: "daily_glucose" }),
        api.get("getAll", { sheet: "daily_bp" }),
      ]);
      if (sum && !sum.error) setSummary(sum);
      if (rem && rem.data) setReminders(rem.data);
      if (lab && lab.data) setLabHistory(lab.data);
      if (glu && glu.data) setGlucoseHistory(glu.data.slice(-14));
      if (bp && bp.data) setBpHistory(bp.data.slice(-14));
    } catch (e) {
      console.log("載入失敗，使用示範資料");
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // 示範資料（後端無資料時顯示）
  const demoSummary = {
    glucose: { value_mgdl:104, timePoint:"空腹", date:"2026-06-03", time:"07:30" },
    bp: { systolic:118, diastolic:76, pulse:72, date:"2026-05-31" },
    weight: { value_kg:75.2, date:"2026-06-02" },
    lab: { hba1c:5.8, date:"2026-05-27", hospital:"台灣新陳代謝科" },
  };
  const demoReminders = [
    { id:"R001", title:"洗牙", icon:"🦷", nextDate:"2026-06-03", overdue:true, diffDays:0 },
    { id:"R002", title:"HbA1c追蹤", icon:"🩸", nextDate:"2026-08-27", overdue:false, diffDays:85 },
    { id:"R003", title:"腎功能追蹤", icon:"🫘", nextDate:"2026-11-27", overdue:false, diffDays:177 },
  ];
  const demoGlucose = [98,102,107,99,104,101,104];
  const demoBP = [{s:116,d:74},{s:120,d:78},{s:118,d:76},{s:115,d:73},{s:119,d:77},{s:117,d:75},{s:118,d:76}];

  const S = summary || demoSummary;
  const R = reminders.length > 0 ? reminders : demoReminders;
  const overdueCount = R.filter(r => r.overdue).length;

  // 儲存血糖
  const saveGlucose = async () => {
    if (!glucoseForm.value) { showToast("⚠️ 請輸入血糖值"); return; }
    const now = new Date();
    await api.post("append", "daily_glucose", {
      date: now.toISOString().split("T")[0],
      time: now.toTimeString().slice(0,5),
      timePoint: glucoseForm.timePoint,
      value_mgdl: parseFloat(glucoseForm.value),
      note: glucoseForm.note,
    });
    showToast("✅ 血糖已儲存");
    setGlucoseForm({ value:"", timePoint:"空腹", note:"" });
    loadData();
  };

  // 儲存血壓
  const saveBP = async () => {
    if (!bpForm.sys || !bpForm.dia) { showToast("⚠️ 請輸入血壓值"); return; }
    const now = new Date();
    await api.post("append", "daily_bp", {
      date: now.toISOString().split("T")[0],
      time: now.toTimeString().slice(0,5),
      systolic: parseInt(bpForm.sys),
      diastolic: parseInt(bpForm.dia),
      pulse: parseInt(bpForm.pulse) || "",
    });
    showToast("✅ 血壓已儲存");
    setBpForm({ sys:"", dia:"", pulse:"" });
    loadData();
  };

  // 儲存體重
  const saveWeight = async () => {
    if (!weightForm.value) { showToast("⚠️ 請輸入體重"); return; }
    const now = new Date();
    await api.post("append", "daily_weight", {
      date: now.toISOString().split("T")[0],
      value_kg: parseFloat(weightForm.value),
    });
    showToast("✅ 體重已儲存");
    setWeightForm({ value:"" });
    loadData();
  };

  // AI 週報
  const generateAIReport = async () => {
    if (!apiKey) { setShowApiInput(true); return; }
    setAiLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:1000,
          messages:[{ role:"user", content:`你是個人健康顧問。用繁體中文分析以下健康資料：

病患：張文彬，55歲，父親T2D家族史，越南工作
最新數值：HbA1c ${S.lab?.hba1c||5.8}%，空腹血糖 ${S.glucose?.value_mgdl||104} mg/dL，ALT 45，HDL 38.5，BMI正常
本週血糖趨勢：${demoGlucose.join(', ')} mg/dL

請提供：
1. 本週健康總評（80字內）
2. 三大重點（各一行）
3. 飲食建議（3點）
4. 運動建議（具體）
5. 一句鼓勵

不用markdown符號，用清楚段落。` }]
        })
      });
      const data = await res.json();
      const text = data.content?.map(b=>b.text||"").join("") || "分析失敗";
      setAiReport(text);
      api.post("saveAIReport", "", { content:text, reportType:"weekly" });
    } catch(e) { setAiReport("請檢查API金鑰是否正確。"); }
    setAiLoading(false);
  };

  // ── 折線圖元件 ────────────────────────────────────────
  const LineChart = ({ data, data2, labels, color, color2, min=0, max=200, refLines=[] }) => {
    const W=320, H=110, P=20;
    const toY = v => P + (1-(v-min)/(max-min))*(H-P*2);
    const toX = i => P + (i/(data.length-1))*(W-P*2);
    const pts = data.map((v,i)=>`${toX(i)},${toY(v)}`).join(" ");
    const pts2 = data2?.map((v,i)=>`${toX(i)},${toY(v)}`).join(" ");
    return (
      <svg width="100%" viewBox={`0 0 ${W} ${H+20}`} style={{display:"block"}}>
        {[0.25,0.5,0.75,1].map(f=>(
          <line key={f} x1={P} y1={toY(min+f*(max-min))} x2={W-P} y2={toY(min+f*(max-min))} stroke={C.border} strokeWidth="1"/>
        ))}
        {refLines.map(r=>(
          <g key={r.v}>
            <line x1={P} y1={toY(r.v)} x2={W-P} y2={toY(r.v)} stroke={r.c} strokeWidth="1.5" strokeDasharray="4,3"/>
            <text x={W-P+2} y={toY(r.v)+4} fontSize="9" fill={r.c}>{r.v}</text>
          </g>
        ))}
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        {pts2 && <polyline points={pts2} fill="none" stroke={color2} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>}
        {data.map((v,i)=>(
          <circle key={i} cx={toX(i)} cy={toY(v)} r="4" fill={color} stroke={C.bg} strokeWidth="2"/>
        ))}
        {data2?.map((v,i)=>(
          <circle key={i} cx={toX(i)} cy={toY(v)} r="4" fill={color2} stroke={C.bg} strokeWidth="2"/>
        ))}
        {labels.map((l,i)=>(
          <text key={i} x={toX(i)} y={H+14} fontSize="9" fill={C.textMuted} textAnchor="middle">{l}</text>
        ))}
        <text x={toX(data.length-1)} y={toY(data[data.length-1])-8} fontSize="11" fill={color} textAnchor="middle" fontWeight="bold">
          {data[data.length-1]}
        </text>
      </svg>
    );
  };

  // ── 首頁 ───────────────────────────────────────────────
  const HomeTab = () => {
    const g = S.glucose; const b = S.bp; const w = S.weight; const l = S.lab;
    const daysSince = (dateStr) => {
      if (!dateStr) return "—";
      const diff = Math.floor((new Date() - new Date(dateStr)) / 86400000);
      if (diff === 0) return "今天";
      if (diff === 1) return "昨天";
      return `${diff}天前`;
    };
    return (
      <div className="fade-in" style={{padding:"16px 16px 80px"}}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <ShieldIcon size={36}/>
            <div>
              <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                <span style={{fontSize:18,fontWeight:700}}>我的健康日誌</span>
                <span style={{fontSize:11,color:C.green,background:"rgba(46,204,138,0.12)",padding:"2px 7px",borderRadius:10}}>{VERSION}</span>
              </div>
              <div style={{fontSize:12,color:C.textMuted}}>
                {new Date().toLocaleDateString("zh-TW",{month:"long",day:"numeric",weekday:"short"})}
              </div>
            </div>
          </div>
          {overdueCount > 0 && (
            <div style={{background:C.red,borderRadius:20,padding:"4px 10px",fontSize:12,color:"white"}}>
              {overdueCount} 項到期
            </div>
          )}
        </div>

        {loading && (
          <div style={{textAlign:"center",color:C.textMuted,fontSize:12,marginBottom:12}}>
            <span className="spin">⟳</span> 載入資料中...
          </div>
        )}

        {/* T2D警示 */}
        <div style={{background:"rgba(255,179,71,0.1)",border:"1px solid rgba(255,179,71,0.3)",borderRadius:12,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:20}}>⚠️</span>
          <div>
            <div style={{fontSize:12,fontWeight:600,color:C.amber}}>糖尿病前期 + 家族史 T2D</div>
            <div style={{fontSize:11,color:C.textMuted}}>HbA1c {l?.hba1c||5.8}% · 需積極管理</div>
          </div>
        </div>

        {/* 數值卡片 */}
        <div style={{fontSize:11,color:C.textMuted,letterSpacing:2,marginBottom:8}}>TODAY'S SNAPSHOT</div>
        <div className="grid-2">
          <div className="card" style={{cursor:"pointer"}} onClick={()=>{setTab("trend");setTrendItem("glucose")}}>
            <div style={{fontSize:11,color:C.textMuted,marginBottom:6}}>🩸 血糖</div>
            <div style={{display:"flex",alignItems:"baseline",gap:6}}>
              <span className="metric-value" style={{fontSize:28,color:C.amber}}>{g?.value_mgdl||"—"}</span>
              <span className="metric-unit">mg/dL</span>
            </div>
            <div style={{fontSize:10,color:C.textMuted,marginTop:4}}>{g?.timePoint||"空腹"} · {daysSince(g?.date)}</div>
            <div style={{display:"flex",gap:2,alignItems:"flex-end",height:20,marginTop:8}}>
              {demoGlucose.map((v,i)=>(
                <div key={i} style={{flex:1,borderRadius:2,height:`${Math.max(20,(v/135)*100)}%`,background:i===demoGlucose.length-1?C.amber:`${C.amber}55`}}/>
              ))}
            </div>
          </div>

          <div className="card" style={{cursor:"pointer"}} onClick={()=>{setTab("trend");setTrendItem("bp")}}>
            <div style={{fontSize:11,color:C.textMuted,marginBottom:6}}>💓 血壓</div>
            <div style={{display:"flex",alignItems:"baseline",gap:4}}>
              <span className="metric-value" style={{fontSize:24,color:C.green}}>{b?.systolic||"—"}</span>
              <span className="metric-unit">/{b?.diastolic||"—"}</span>
            </div>
            <div style={{fontSize:10,color:C.textMuted,marginTop:4}}>mmHg · {daysSince(b?.date)}</div>
            <div style={{marginTop:10}}><span className="status-chip status-ok">正常</span></div>
          </div>

          <div className="card" style={{cursor:"pointer"}} onClick={()=>{setTab("trend");setTrendItem("weight")}}>
            <div style={{fontSize:11,color:C.textMuted,marginBottom:6}}>⚖️ 體重</div>
            <div style={{display:"flex",alignItems:"baseline",gap:6}}>
              <span className="metric-value" style={{fontSize:28}}>{w?.value_kg||"—"}</span>
              <span className="metric-unit">kg</span>
            </div>
            <div style={{fontSize:10,color:C.textMuted,marginTop:4}}>{daysSince(w?.date)}</div>
            <div style={{marginTop:10}}><span className="status-chip status-ok">正常範圍</span></div>
          </div>

          <div className="card" style={{cursor:"pointer"}} onClick={()=>setSelectedKnowledge(KNOWLEDGE_ITEMS[0])}>
            <div style={{fontSize:11,color:C.textMuted,marginBottom:6}}>📊 HbA1c</div>
            <div style={{display:"flex",alignItems:"baseline",gap:6}}>
              <span className="metric-value" style={{fontSize:28,color:C.amber}}>{l?.hba1c||"—"}</span>
              <span className="metric-unit">%</span>
            </div>
            <div style={{fontSize:10,color:C.textMuted,marginTop:4}}>{daysSince(l?.date)}</div>
            <div style={{marginTop:10}}><span className="status-chip status-warn">前期範圍</span></div>
          </div>
        </div>

        {/* 今日待記錄 */}
        <div className="card">
          <div className="card-title">今日待記錄</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {[{label:"午餐",icon:"🍱"},{label:"晚餐",icon:"🍽️"},{label:"血糖(飯後)",icon:"🩸"},{label:"運動",icon:"🏃"}].map(item=>(
              <div key={item.label} onClick={()=>setTab("record")}
                style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 12px",fontSize:12,color:C.textMuted,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                {item.icon} {item.label}
              </div>
            ))}
          </div>
        </div>

        {/* 健康提醒 */}
        <div className="card">
          <div className="card-title">定期健康提醒</div>
          {R.slice(0,4).map(r=>(
            <div key={r.id} className="reminder-item">
              <span style={{fontSize:22}}>{r.icon}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:500}}>{r.title}</div>
                <div style={{fontSize:11,color:C.textMuted}}>下次：{r.nextDate}</div>
              </div>
              <span className={`status-chip ${r.overdue?"status-alert":"status-ok"}`}>
                {r.overdue?"今天到期！":r.diffDays<=30?"快到了":"待追蹤"}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ── 趨勢 ───────────────────────────────────────────────
  const TrendTab = () => {
    const days7 = ["週一","週二","週三","週四","週五","週六","週日"];
    const gData = glucoseHistory.length>=7 ? glucoseHistory.slice(-7).map(r=>parseFloat(r.value_mgdl)) : demoGlucose;
    const bData = bpHistory.length>=7 ? bpHistory.slice(-7).map(r=>parseInt(r.systolic)) : demoBP.map(b=>b.s);
    const bData2 = bpHistory.length>=7 ? bpHistory.slice(-7).map(r=>parseInt(r.diastolic)) : demoBP.map(b=>b.d);

    const labData = labHistory.length>0 ? labHistory : [
      {date:"2025/05/20",hospital:"越南醫院",hba1c:5.6,alt:38,hdl:41.0,ldl:58.0},
      {date:"2025/11/15",hospital:"台灣",hba1c:5.7,alt:42,hdl:39.2,ldl:55.3},
      {date:"2026/05/27",hospital:"台灣",hba1c:5.8,alt:45,hdl:38.5,ldl:50.1},
    ];

    const BTNS = [{key:"glucose",label:"血糖"},{key:"bp",label:"血壓"},{key:"lab",label:"抽血指標"}];
    return (
      <div className="fade-in" style={{padding:"16px 16px 80px"}}>
        <div className="section-header">📈 健康趨勢</div>
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          {BTNS.map(t=>(
            <button key={t.key} className="btn-secondary"
              style={{flex:1,padding:"8px 4px",fontSize:12,background:trendItem===t.key?"rgba(46,204,138,0.2)":C.bgCard,borderColor:trendItem===t.key?C.green:C.border,color:trendItem===t.key?C.green:C.textMuted}}
              onClick={()=>setTrendItem(t.key)}>{t.label}</button>
          ))}
        </div>

        {trendItem==="glucose" && (
          <div className="card">
            <div className="card-title">近7次空腹血糖</div>
            <LineChart data={gData} labels={days7.slice(-gData.length)} color={C.amber} min={80} max={140}
              refLines={[{v:100,c:C.amber},{v:126,c:C.red}]}/>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:12}}>
              {[["最低",Math.min(...gData),C.green],["平均",Math.round(gData.reduce((a,b)=>a+b,0)/gData.length),C.amber],["最高",Math.max(...gData),C.red]].map(([l,v,c])=>(
                <div key={l} style={{textAlign:"center"}}>
                  <div style={{fontSize:11,color:C.textMuted}}>{l}</div>
                  <div style={{fontSize:20,fontWeight:700,color:c}}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {trendItem==="bp" && (
          <div className="card">
            <div className="card-title">近7次血壓</div>
            <LineChart data={bData} data2={bData2} labels={days7.slice(-bData.length)} color={C.green} color2={C.blue} min={55} max={145}
              refLines={[{v:130,c:C.amber}]}/>
            <div style={{display:"flex",gap:16,marginTop:8}}>
              {[[C.green,"收縮壓"],[C.blue,"舒張壓"]].map(([c,l])=>(
                <div key={l} style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{width:12,height:3,background:c,borderRadius:2}}/>
                  <span style={{fontSize:11,color:C.textMuted}}>{l}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {trendItem==="lab" && (
          <>
            <div style={{fontSize:12,color:C.textMuted,marginBottom:12}}>
              抽血日期：{labData.map(l=>String(l.date).slice(2,7)).join(" → ")}
            </div>
            {[
              {key:"hba1c",label:"HbA1c",unit:"%",color:C.amber,ref:"4–6%"},
              {key:"alt",label:"ALT",unit:"U/L",color:C.red,ref:"4–44"},
              {key:"hdl",label:"HDL-C",unit:"mg/dL",color:C.green,ref:">40(男)"},
              {key:"ldl",label:"LDL-C",unit:"mg/dL",color:C.blue,ref:"<130"},
            ].map(item=>(
              <div key={item.key} className="card" style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                  <span style={{fontSize:13,fontWeight:600,color:item.color}}>{item.label}</span>
                  <span style={{fontSize:11,color:C.textMuted}}>參考：{item.ref} {item.unit}</span>
                </div>
                <div style={{display:"flex",alignItems:"flex-end",gap:12,height:60}}>
                  {labData.map((l,i)=>{
                    const v = parseFloat(l[item.key])||0;
                    const maxV = Math.max(...labData.map(x=>parseFloat(x[item.key])||0))*1.2;
                    const h = Math.max(20,(v/maxV)*55);
                    return (
                      <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                        <div style={{fontSize:11,color:item.color,fontWeight:700}}>{v}</div>
                        <div style={{width:"100%",height:h,background:`linear-gradient(to top,${item.color}99,${item.color}44)`,borderRadius:4}}/>
                        <div style={{fontSize:9,color:C.textMuted}}>{String(l.date).slice(2,7)}</div>
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

  // ── 記錄 ───────────────────────────────────────────────
  const RecordTab = () => {
    const SUBS = [{key:"glucose",label:"🩸血糖"},{key:"bp",label:"💓血壓"},{key:"weight",label:"⚖️體重"},{key:"meal",label:"🍱飲食"},{key:"exercise",label:"🏃運動"},{key:"lab",label:"📋抽血"}];
    return (
      <div className="fade-in" style={{padding:"16px 16px 80px"}}>
        <div className="section-header">📝 記錄</div>
        <div style={{display:"flex",gap:6,overflowX:"auto",marginBottom:16,paddingBottom:4}}>
          {SUBS.map(t=>(
            <button key={t.key} onClick={()=>setRecordTab(t.key)}
              style={{whiteSpace:"nowrap",padding:"7px 14px",borderRadius:20,border:`1px solid ${recordTab===t.key?C.green:C.border}`,background:recordTab===t.key?"rgba(46,204,138,0.15)":C.bg,color:recordTab===t.key?C.green:C.textMuted,fontSize:12,cursor:"pointer",fontFamily:"'Noto Sans TC',sans-serif"}}>
              {t.label}
            </button>
          ))}
        </div>

        {recordTab==="glucose" && (
          <div className="card">
            <div className="card-title">記錄血糖</div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:12,color:C.textMuted,marginBottom:8}}>時間點</div>
              <div className="grid-3">
                {["空腹","飯後2hr","睡前"].map(tp=>(
                  <div key={tp} className={`time-btn ${glucoseForm.timePoint===tp?"selected":""}`} onClick={()=>setGlucoseForm(f=>({...f,timePoint:tp}))}>{tp}</div>
                ))}
              </div>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:12,color:C.textMuted,marginBottom:6}}>血糖值 (mg/dL)</div>
              <input className="input-field" type="number" placeholder="例：104" value={glucoseForm.value} onChange={e=>setGlucoseForm(f=>({...f,value:e.target.value}))}/>
            </div>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:12,color:C.textMuted,marginBottom:6}}>備註（可選）</div>
              <input className="input-field" placeholder="例：飯後運動30分鐘" value={glucoseForm.note} onChange={e=>setGlucoseForm(f=>({...f,note:e.target.value}))}/>
            </div>
            <button className="btn-primary" onClick={saveGlucose}>儲存到 Google Sheets</button>
          </div>
        )}

        {recordTab==="bp" && (
          <div className="card">
            <div className="card-title">記錄血壓</div>
            <div className="grid-3" style={{marginBottom:12}}>
              {[["收縮壓","118",bpForm.sys,v=>setBpForm(f=>({...f,sys:v}))],["舒張壓","76",bpForm.dia,v=>setBpForm(f=>({...f,dia:v}))],["心率","72",bpForm.pulse,v=>setBpForm(f=>({...f,pulse:v}))]].map(([l,p,v,set])=>(
                <div key={l}>
                  <div style={{fontSize:11,color:C.textMuted,marginBottom:6}}>{l}</div>
                  <input className="input-field" type="number" placeholder={p} value={v} onChange={e=>set(e.target.value)}/>
                </div>
              ))}
            </div>
            <div style={{background:C.bg,borderRadius:10,padding:10,marginBottom:14,fontSize:12,color:C.textMuted}}>💡 建議安靜休息5分鐘後量測</div>
            <button className="btn-primary" onClick={saveBP}>儲存到 Google Sheets</button>
          </div>
        )}

        {recordTab==="weight" && (
          <div className="card">
            <div className="card-title">記錄體重</div>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:12,color:C.textMuted,marginBottom:6}}>體重 (kg)</div>
              <input className="input-field" type="number" step="0.1" placeholder="例：75.2" value={weightForm.value} onChange={e=>setWeightForm({value:e.target.value})}/>
            </div>
            <div style={{background:C.bg,borderRadius:10,padding:10,marginBottom:14,fontSize:12,color:C.textMuted}}>💡 建議每天早上空腹量測</div>
            <button className="btn-primary" onClick={saveWeight}>儲存到 Google Sheets</button>
          </div>
        )}

        {recordTab==="meal" && (
          <div className="card">
            <div className="card-title">記錄飲食</div>
            <div style={{display:"flex",gap:8,marginBottom:14}}>
              {["早餐","午餐","晚餐","點心"].map(m=>(
                <div key={m} style={{flex:1,textAlign:"center",padding:"10px 4px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,fontSize:12,color:C.textMuted,cursor:"pointer"}}>{m}</div>
              ))}
            </div>
            <div style={{border:`2px dashed ${C.border}`,borderRadius:12,padding:"24px 16px",textAlign:"center",marginBottom:12,cursor:"pointer"}}>
              <div style={{fontSize:32,marginBottom:8}}>📸</div>
              <div style={{fontSize:14,color:C.textMuted}}>拍照 AI 自動分析營養成分</div>
              <div style={{fontSize:11,color:C.textMuted,marginTop:4}}>支援越南料理辨識</div>
            </div>
            <input className="input-field" placeholder="或輸入食物名稱（例：越南河粉）" style={{marginBottom:12}}/>
            <button className="btn-primary" onClick={()=>showToast("✅ 飲食記錄已儲存")}>儲存</button>
          </div>
        )}

        {recordTab==="exercise" && (
          <div className="card">
            <div className="card-title">記錄運動</div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:12,color:C.textMuted,marginBottom:8}}>運動類型</div>
              <div className="grid-3">
                {["走路","騎車","游泳","重訓","瑜伽","其他"].map(type=>(
                  <div key={type} className="time-btn" style={{padding:"10px 4px"}}>{type}</div>
                ))}
              </div>
            </div>
            <div className="grid-2" style={{marginBottom:12}}>
              <div>
                <div style={{fontSize:11,color:C.textMuted,marginBottom:6}}>時長（分鐘）</div>
                <input className="input-field" type="number" placeholder="30"/>
              </div>
              <div>
                <div style={{fontSize:11,color:C.textMuted,marginBottom:6}}>強度</div>
                <select className="input-field"><option>輕度</option><option>中度</option><option>高強度</option></select>
              </div>
            </div>
            <div style={{background:C.bg,borderRadius:10,padding:10,marginBottom:14,fontSize:12,color:C.green}}>
              💡 飯後30分鐘走路15分鐘，可降低血糖約10-15 mg/dL
            </div>
            <button className="btn-primary" onClick={()=>showToast("✅ 運動記錄已儲存")}>儲存</button>
          </div>
        )}

        {recordTab==="lab" && (
          <div className="card">
            <div className="card-title">上傳抽血報告</div>
            <div className="grid-2" style={{marginBottom:12}}>
              <div>
                <div style={{fontSize:11,color:C.textMuted,marginBottom:6}}>醫院</div>
                <input className="input-field" placeholder="台大醫院"/>
              </div>
              <div>
                <div style={{fontSize:11,color:C.textMuted,marginBottom:6}}>國家</div>
                <select className="input-field"><option>台灣</option><option>越南</option></select>
              </div>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:C.textMuted,marginBottom:6}}>抽血日期</div>
              <input className="input-field" type="date"/>
            </div>
            <div style={{border:`2px dashed ${C.border}`,borderRadius:12,padding:"20px 16px",textAlign:"center",marginBottom:12,cursor:"pointer"}}>
              <div style={{fontSize:32,marginBottom:8}}>📄</div>
              <div style={{fontSize:14,color:C.textMuted}}>拍照上傳報告</div>
              <div style={{fontSize:11,color:C.textMuted,marginTop:4}}>AI自動辨識 · 台灣/越南格式 · 單位自動換算</div>
            </div>
            <textarea className="input-field" rows={4} placeholder="或貼上報告文字..." style={{resize:"none",marginBottom:12}}/>
            <button className="btn-primary" onClick={()=>showToast("✅ 報告解析中...")}>解析並儲存</button>
          </div>
        )}
      </div>
    );
  };

  // ── AI分析 ─────────────────────────────────────────────
  const AITab = () => (
    <div className="fade-in" style={{padding:"16px 16px 80px"}}>
      <div className="section-header">🤖 AI 健康分析</div>
      {showApiInput && (
        <div className="card" style={{marginBottom:12}}>
          <div className="card-title">設定 Claude API 金鑰</div>
          <input className="input-field" type="password" placeholder="sk-ant-..." value={apiKey} onChange={e=>setApiKey(e.target.value)} style={{marginBottom:10}}/>
          <button className="btn-primary" onClick={()=>{localStorage.setItem("hj_apikey",apiKey);setShowApiInput(false);generateAIReport();}}>確認並分析</button>
        </div>
      )}
      <div className="ai-bubble" style={{marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
          <div style={{width:40,height:40,borderRadius:"50%",background:`linear-gradient(135deg,${C.green},${C.greenDark})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🤖</div>
          <div>
            <div style={{fontSize:14,fontWeight:600,color:C.green}}>Claude AI 健康顧問</div>
            <div style={{fontSize:11,color:C.textMuted}}>內建 T2D 家族史 · 個人化分析</div>
          </div>
        </div>
        {aiReport ? (
          <div style={{fontSize:13,color:C.text,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{aiReport}</div>
        ) : (
          <div style={{fontSize:13,color:C.textMuted,lineHeight:1.7}}>
            根據你的健康數據與家族史，提供：<br/>
            • 本週健康總評 · 重點關注項目<br/>
            • 個人化飲食與運動建議<br/>
            • 下次追蹤提醒
          </div>
        )}
      </div>
      <button className="btn-primary" style={{marginBottom:12}} onClick={generateAIReport} disabled={aiLoading}>
        {aiLoading ? "⏳ AI 分析中..." : "🔍 產生本週AI健康週報"}
      </button>
      <div className="card">
        <div className="card-title">T2D 風險評估</div>
        {[
          ["HbA1c 5.8%",70,C.amber],["空腹血糖 104",55,C.amber],
          ["家族史 T2D",85,C.red],["HDL偏低",45,C.amber],["ALT輕微偏高",35,C.blue],
        ].map(([l,r,c])=>(
          <div key={l} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <span style={{fontSize:12}}>{l}</span>
              <span style={{fontSize:12,color:c}}>{r}%</span>
            </div>
            <div style={{height:6,background:C.bg,borderRadius:3,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${r}%`,background:c,borderRadius:3}}/>
            </div>
          </div>
        ))}
        <div style={{fontSize:11,color:C.textMuted,textAlign:"center",marginTop:4}}>⚠️ 僅供參考，不代表醫療診斷</div>
      </div>
    </div>
  );

  // ── 知識庫 ─────────────────────────────────────────────
  const KnowledgeTab = () => {
    if (selectedKnowledge) {
      const item = selectedKnowledge;
      return (
        <div className="fade-in" style={{padding:"16px 16px 80px"}}>
          <button className="btn-secondary" style={{marginBottom:16}} onClick={()=>setSelectedKnowledge(null)}>← 返回</button>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
            <span style={{fontSize:36}}>{item.icon}</span>
            <div>
              <div style={{fontSize:18,fontWeight:700,color:item.color}}>{item.title}</div>
            </div>
          </div>
          <div className="card"><div className="card-title">是什麼？</div><div style={{fontSize:14,lineHeight:1.7}}>{item.desc}</div></div>
          <div className="card">
            <div className="card-title">數值範圍</div>
            {item.levels.map(l=>(
              <div key={l.label} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
                <span style={{fontSize:13}}>{l.label}</span>
                <span style={{fontSize:13,fontWeight:600,color:l.color}}>{l.range}</span>
              </div>
            ))}
          </div>
          <div className="card" style={{border:`1px solid ${item.color}44`}}>
            <div className="card-title">你的數值</div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span style={{fontSize:28,fontFamily:"'DM Serif Display',serif",color:item.color}}>{item.yourValue}</span>
              <span className={`status-chip ${item.yourStatus==="ok"?"status-ok":"status-warn"}`}>
                {item.yourStatus==="ok"?"✅ 正常":"⚠️ 需注意"}
              </span>
            </div>
          </div>
          <div className="card">
            <div className="card-title">改善建議</div>
            {item.tips.map((tip,i)=>(
              <div key={i} style={{display:"flex",gap:10,padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
                <span style={{color:C.green,fontWeight:700}}>{i+1}</span>
                <span style={{fontSize:13,lineHeight:1.6}}>{tip}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className="fade-in" style={{padding:"16px 16px 80px"}}>
        <div className="section-header">📚 健康知識庫</div>
        <div style={{background:"rgba(255,179,71,0.08)",border:"1px solid rgba(255,179,71,0.25)",borderRadius:14,padding:14,marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:700,color:C.amber,marginBottom:6}}>📌 糖尿病前期專區（適合你）</div>
          <div style={{fontSize:12,color:C.textMuted,lineHeight:1.7}}>HbA1c 5.8% + 家族史 T2D = 高風險群。<br/>好消息：糖尿病前期是可逆的！</div>
        </div>
        <div style={{fontSize:13,fontWeight:600,color:C.textMuted,marginBottom:10,letterSpacing:1}}>LABORATORY VALUES</div>
        {KNOWLEDGE_ITEMS.map(item=>(
          <div key={item.key} className="knowledge-card" style={{borderLeftColor:item.color}} onClick={()=>setSelectedKnowledge(item)}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:22}}>{item.icon}</span>
                <div>
                  <div style={{fontSize:14,fontWeight:600}}>{item.title}</div>
                  <div style={{fontSize:11,color:C.textMuted}}>你的值：{item.yourValue}</div>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span className={`status-chip ${item.yourStatus==="ok"?"status-ok":"status-warn"}`}>{item.yourStatus==="ok"?"正常":"注意"}</span>
                <span style={{color:C.textMuted}}>›</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const TABS = [
    {key:"home",label:"首頁",icon:<HomeIcon/>},
    {key:"trend",label:"趨勢",icon:<TrendIcon/>},
    {key:"record",label:"記錄",icon:<RecordIcon/>},
    {key:"ai",label:"AI分析",icon:<AIIcon/>},
    {key:"knowledge",label:"知識庫",icon:<BookIcon/>},
  ];

  return (
    <>
      <style>{styles}</style>
      {toast && <div className="save-toast">{toast}</div>}
      <div style={{maxWidth:480,margin:"0 auto",minHeight:"100vh",background:C.bg}}>
        {tab==="home" && <HomeTab/>}
        {tab==="trend" && <TrendTab/>}
        {tab==="record" && <RecordTab/>}
        {tab==="ai" && <AITab/>}
        {tab==="knowledge" && <KnowledgeTab/>}
        <div className="tab-bar">
          {TABS.map(t=>(
            <button key={t.key} className={`tab-btn ${tab===t.key?"active":""}`}
              onClick={()=>{setTab(t.key);if(t.key!=="knowledge")setSelectedKnowledge(null);}}>
              {t.icon}<span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
