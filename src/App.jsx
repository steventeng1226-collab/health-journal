import React, { useState, useEffect, useCallback, useRef } from "react";

const VERSION = "v1.6";
const GAS_URL = "https://script.google.com/macros/s/AKfycbzEQmF8JD_QI_Wq4fOpcwkCXKjrKG8ke63wqR8Mfx0IvUeSLxseJUwSncmJhuJpf4cyqw/exec";
const CLAUDE_API = "https://api.anthropic.com/v1/messages";

const api = {
  get: async (action, params={}) => {
    try { const q=new URLSearchParams({action,...params}).toString(); return (await fetch(`${GAS_URL}?${q}`)).json(); }
    catch(e){ return {error:e.toString()}; }
  },
  post: async (action, sheet, data) => {
    try { return (await fetch(GAS_URL,{method:"POST",body:JSON.stringify({action,sheet,data})})).json(); }
    catch(e){ return {error:e.toString()}; }
  },
};

const C = {
  bg:"#0d1f17",bgCard:"#132a1e",bgCard2:"#1a3828",
  green:"#2ecc8a",greenDark:"#1a8c5e",
  red:"#ff5a7e",amber:"#ffb347",blue:"#5ab4ff",purple:"#c084fc",
  text:"#e8f5ef",textMuted:"#7aaa90",
  border:"rgba(46,204,138,0.15)",borderBright:"rgba(46,204,138,0.35)",
};

const toMgdl=(v,unit)=>unit==="mmol/L"?Math.round(parseFloat(v)*18.016*10)/10:parseFloat(v);
const fmtDate=(d)=>{if(!d)return"—";const s=String(d).slice(0,10);const p=s.split("-");return p.length===3?`${p[1]}/${p[2]}`:s;};
const daysSince=(d)=>{if(!d)return"—";const diff=Math.floor((new Date()-new Date(String(d).slice(0,10)))/86400000);if(diff===0)return"今天";if(diff===1)return"昨天";return`${diff}天前`;};
const today=()=>new Date().toISOString().split("T")[0];

const LAB_FIELDS = [
  {key:"date",label:"抽血日期",type:"date",required:true},
  {key:"hospital",label:"醫院名稱",type:"hospital",required:true},
  {key:"country",label:"國家",type:"select",options:["台灣","越南"],required:true},
  {key:"fasting",label:"空腹狀態",type:"select",options:["空腹","非空腹","不確定"]},
  {key:"doctor",label:"醫師（選填）",type:"text",placeholder:"醫師姓名"},
  {key:"hba1c",label:"HbA1c (%)",type:"number",placeholder:"5.8"},
  {key:"glucose_ac",label:"空腹血糖 (mg/dL)",type:"number",placeholder:"104"},
  {key:"alt",label:"ALT (U/L)",type:"number",placeholder:"45"},
  {key:"ast",label:"AST (U/L)",type:"number",placeholder:""},
  {key:"hdl",label:"HDL-C (mg/dL)",type:"number",placeholder:"38.5"},
  {key:"ldl",label:"LDL-C (mg/dL)",type:"number",placeholder:"50.1"},
  {key:"tg",label:"三酸甘油酯 (mg/dL)",type:"number",placeholder:"70"},
  {key:"cholesterol",label:"總膽固醇 (mg/dL)",type:"number",placeholder:"96"},
  {key:"uric_acid",label:"尿酸 (mg/dL)",type:"number",placeholder:"5.4"},
  {key:"creatinine",label:"肌酸酐 (mg/dL)",type:"number",placeholder:"0.84"},
  {key:"gfr",label:"eGFR",type:"number",placeholder:"102"},
  {key:"upcr",label:"UPCR (mg/g)",type:"number",placeholder:"76.40"},
  {key:"tsh",label:"TSH (uIU/mL)",type:"number",placeholder:"1.979"},
  {key:"hb",label:"血紅素 Hb (g/dL)",type:"number",placeholder:"14.4"},
  {key:"wbc",label:"白血球 WBC",type:"number",placeholder:"4.3"},
  {key:"platelet",label:"血小板 Platelet",type:"number",placeholder:"137"},
  {key:"note",label:"備註",type:"textarea",placeholder:"其他說明..."},
];

const styles=`
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700&family=DM+Serif+Display&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:${C.bg};color:${C.text};font-family:'Noto Sans TC',sans-serif;}
  ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-track{background:${C.bg};} ::-webkit-scrollbar-thumb{background:${C.greenDark};border-radius:2px;}
  @keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  .fade-in{animation:fadeIn 0.4s ease forwards;}
  .spin{animation:spin 1s linear infinite;display:inline-block;}
  .tab-bar{position:fixed;bottom:0;left:0;right:0;background:${C.bgCard};border-top:1px solid ${C.border};display:flex;z-index:100;padding-bottom:env(safe-area-inset-bottom);}
  .tab-btn{flex:1;padding:10px 4px 8px;background:none;border:none;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px;color:${C.textMuted};font-size:10px;font-family:'Noto Sans TC',sans-serif;transition:color 0.2s;}
  .tab-btn.active{color:${C.green};} .tab-btn svg{width:22px;height:22px;}
  .card{background:${C.bgCard};border:1px solid ${C.border};border-radius:16px;padding:16px;margin-bottom:12px;}
  .card-title{font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${C.textMuted};margin-bottom:12px;font-weight:500;}
  .status-chip{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:500;}
  .status-ok{background:rgba(46,204,138,0.15);color:${C.green};}
  .status-warn{background:rgba(255,179,71,0.15);color:${C.amber};}
  .status-alert{background:rgba(255,90,126,0.15);color:${C.red};}
  .input-field{width:100%;background:${C.bg};border:1px solid ${C.border};border-radius:10px;padding:12px 14px;color:${C.text};font-family:'Noto Sans TC',sans-serif;font-size:15px;outline:none;transition:border-color 0.2s;}
  .input-field:focus{border-color:${C.green};} .input-field::placeholder{color:${C.textMuted};}
  .btn-primary{width:100%;padding:14px;background:linear-gradient(135deg,${C.green},${C.greenDark});border:none;border-radius:12px;color:#0d1f17;font-weight:700;font-size:15px;cursor:pointer;font-family:'Noto Sans TC',sans-serif;transition:opacity 0.2s;}
  .btn-primary:active{opacity:0.85;} .btn-primary:disabled{opacity:0.5;}
  .btn-secondary{padding:10px 20px;background:${C.bgCard2};border:1px solid ${C.borderBright};border-radius:10px;color:${C.green};font-size:13px;cursor:pointer;font-family:'Noto Sans TC',sans-serif;}
  .btn-sm{padding:6px 14px;background:${C.bgCard2};border:1px solid ${C.border};border-radius:8px;color:${C.textMuted};font-size:12px;cursor:pointer;font-family:'Noto Sans TC',sans-serif;}
  .btn-sm.active{border-color:${C.green};color:${C.green};background:rgba(46,204,138,0.1);}
  .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
  .grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;}
  .time-btn{padding:8px;border-radius:8px;text-align:center;font-size:12px;cursor:pointer;border:1px solid ${C.border};background:${C.bg};color:${C.textMuted};font-family:'Noto Sans TC',sans-serif;transition:all 0.2s;}
  .time-btn.selected{background:rgba(46,204,138,0.15);border-color:${C.green};color:${C.green};}
  .save-toast{position:fixed;top:20px;left:50%;transform:translateX(-50%);background:${C.green};color:#0d1f17;padding:10px 24px;border-radius:20px;font-weight:700;font-size:14px;z-index:999;animation:fadeIn 0.3s ease;}
  .section-header{font-size:20px;font-weight:700;color:${C.text};margin-bottom:16px;display:flex;align-items:center;gap:10px;}
  .source-tag{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;}
  .source-daily{background:rgba(46,204,138,0.15);color:${C.green};}
  .source-hospital{background:rgba(90,180,255,0.15);color:${C.blue};}
  .knowledge-card{background:${C.bgCard2};border-radius:12px;padding:14px;margin-bottom:10px;border-left:3px solid ${C.green};cursor:pointer;}
  .reminder-item{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid ${C.border};}
  .reminder-item:last-child{border-bottom:none;}
  .ai-bubble{background:linear-gradient(135deg,rgba(46,204,138,0.1),rgba(26,140,94,0.05));border:1px solid ${C.borderBright};border-radius:16px;padding:16px;}
  .empty-state{text-align:center;padding:32px 16px;color:${C.textMuted};font-size:13px;}
  select.input-field{appearance:none;}
  .paste-area{width:100%;min-height:120px;background:${C.bg};border:2px dashed ${C.borderBright};border-radius:12px;padding:14px;color:${C.text};font-family:'Noto Sans TC',sans-serif;font-size:14px;outline:none;resize:vertical;line-height:1.7;}
  .paste-area:focus{border-color:${C.green};}
  .paste-area::placeholder{color:${C.textMuted};}
  .field-row{margin-bottom:12px;}
  .field-label{font-size:12px;color:${C.textMuted};margin-bottom:6px;display:flex;align-items:center;gap:4px;}
  .field-required{color:${C.red};font-size:10px;}
  .confirm-field{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:${C.bg};border-radius:8px;margin-bottom:6px;border:1px solid ${C.border};}
  .confirm-field.filled{border-color:rgba(46,204,138,0.3);}
  .photo-preview{position:relative;width:80px;height:80px;border-radius:8px;overflow:hidden;flex-shrink:0;}
  .photo-preview img{width:100%;height:100%;object-fit:cover;}
  .photo-del{position:absolute;top:2px;right:2px;background:rgba(0,0,0,0.7);border:none;border-radius:50%;width:20px;height:20px;color:white;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;}
  .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.75);display:flex;align-items:flex-end;justify-content:center;z-index:200;padding:0;}
  .overlay-sheet{background:${C.bgCard};border-radius:20px 20px 0 0;width:100%;max-width:480px;padding:20px;max-height:90vh;overflow-y:auto;}
`;

// Icons
const ShieldIcon=({size=28})=>(
  <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
    <defs><linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#2ecc8a"/><stop offset="100%" stopColor="#1a6b4a"/></linearGradient></defs>
    <path d="M256 40L400 100L400 250C400 330 330 395 256 420C182 395 112 330 112 250L112 100Z" fill="url(#sg)"/>
    <path d="M185 250C185 222 200 208 215 208C226 208 236 215 244 226C252 215 262 208 273 208C288 208 303 222 303 250C303 290 256 320 256 320C256 320 209 290 185 250Z" fill="#ff5a7e"/>
    <polyline points="145,248 178,248 192,222 208,274 222,238 244,248 256,248 270,228 284,264 298,248 340,248" stroke="white" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);
const HomeIcon=()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const TrendIcon=()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
const RecordIcon=()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>;
const AIIcon=()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 110 20A10 10 0 0112 2z"/><path d="M9 9h.01M15 9h.01M9.5 15a4 4 0 005 0"/></svg>;
const BookIcon=()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>;
const SettingIcon=()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>;

const KNOWLEDGE_ITEMS=[
  {key:"hba1c",title:"HbA1c 糖化血色素",icon:"🩸",color:C.red,desc:"反映過去3個月的平均血糖水準，是診斷糖尿病前期的黃金指標。不受單次血糖波動影響。",levels:[{label:"正常",range:"< 5.7%",color:C.green},{label:"糖尿病前期⚠️",range:"5.7–6.4%",color:C.amber},{label:"糖尿病",range:"≥ 6.5%",color:C.red}],yourValue:"5.8%",yourStatus:"warn",tips:["每3個月追蹤一次","減少精緻碳水：白飯、麵包、含糖飲料","飯後30分鐘步行15分鐘效果最佳","體重每減1kg，HbA1c約可降0.1%"]},
  {key:"glucose",title:"空腹血糖 Glucose AC",icon:"🍬",color:C.amber,desc:"空腹8小時後的血糖值。Accu-Chek顯示mmol/L，APP自動換算成mg/dL（×18）。",levels:[{label:"正常",range:"70–99 mg/dL",color:C.green},{label:"前期⚠️",range:"100–125 mg/dL",color:C.amber},{label:"糖尿病",range:"≥ 126 mg/dL",color:C.red}],yourValue:"104 mg/dL",yourStatus:"warn",tips:["晚餐後不吃宵夜","避免含糖飲料（包括果汁）","有氧運動可改善胰島素敏感性"]},
  {key:"alt",title:"ALT 丙胺酸轉胺酶",icon:"🫀",color:C.amber,desc:"肝細胞損傷時釋放的酵素，是肝功能最敏感的指標。輕微偏高常見於脂肪肝。",levels:[{label:"正常",range:"4–44 U/L",color:C.green},{label:"輕微偏高",range:"45–80 U/L",color:C.amber},{label:"明顯異常",range:"> 80 U/L",color:C.red}],yourValue:"45 U/L",yourStatus:"warn",tips:["減重5-10%可顯著改善脂肪肝","避免過量飲酒","多吃十字花科蔬菜"]},
  {key:"hdl",title:"HDL 好膽固醇",icon:"💚",color:C.green,desc:"負責將血管中多餘膽固醇運回肝臟代謝，數值越高越保護心血管。",levels:[{label:"理想(男)",range:"> 40 mg/dL",color:C.green},{label:"偏低⚠️",range:"< 40 mg/dL",color:C.amber}],yourValue:"38.5 mg/dL",yourStatus:"warn",tips:["規律有氧運動是提升HDL最有效方法","攝取健康脂肪：橄欖油、堅果","減少反式脂肪"]},
  {key:"ldl",title:"LDL 壞膽固醇",icon:"⚠️",color:C.blue,desc:"容易沉積在血管壁造成動脈硬化，是心血管疾病主要風險因子。",levels:[{label:"理想",range:"< 100 mg/dL",color:C.green},{label:"正常",range:"100–129 mg/dL",color:C.green},{label:"偏高",range:"130–159 mg/dL",color:C.amber},{label:"高",range:"≥ 160 mg/dL",color:C.red}],yourValue:"50.1 mg/dL",yourStatus:"ok",tips:["維持現有飲食習慣","減少飽和脂肪：紅肉、全脂乳品","增加膳食纖維：燕麥、豆類"]},
  {key:"uricAcid",title:"尿酸 Uric Acid",icon:"🔬",color:C.blue,desc:"嘌呤代謝產物，過高會在關節沉積引起痛風，也與腎功能相關。",levels:[{label:"正常(男)",range:"4.4–7.6 mg/dL",color:C.green},{label:"偏高",range:"7.6–9.0 mg/dL",color:C.amber},{label:"高風險",range:"≥ 9.0 mg/dL",color:C.red}],yourValue:"5.4 mg/dL",yourStatus:"ok",tips:["每天喝水2000ml以上","限制內臟類食物","避免啤酒和含糖飲料"]},
  {key:"creatinine",title:"肌酸酐 Creatinine",icon:"🫘",color:C.blue,desc:"腎臟過濾排出的代謝物，是評估腎功能的基本指標。",levels:[{label:"正常(男)",range:"0.7–1.3 mg/dL",color:C.green},{label:"輕度異常",range:"1.3–2.0 mg/dL",color:C.amber}],yourValue:"0.84 mg/dL",yourStatus:"ok",tips:["多喝水保護腎臟","控制血糖","避免長期服用止痛藥"]},
  {key:"upcr",title:"UPCR 尿蛋白肌酸酐比值",icon:"💧",color:C.amber,desc:"偵測早期腎臟損傷的敏感指標，正常腎臟不應讓蛋白質漏出。",levels:[{label:"正常",range:"< 30 mg/g",color:C.green},{label:"微量蛋白尿",range:"30–300 mg/g",color:C.amber},{label:"大量蛋白尿",range:"≥ 300 mg/g",color:C.red}],yourValue:"76.40 mg/g",yourStatus:"warn",tips:["控制血糖是保護腎臟最重要的事","控制血壓（目標<130/80）","每6個月複查"]},
  {key:"tsh",title:"TSH 甲狀腺促素",icon:"🦋",color:C.green,desc:"腦下垂體分泌用來控制甲狀腺功能的激素，你的數值完全正常。",levels:[{label:"正常",range:"0.34–5.60 uIU/mL",color:C.green},{label:"偏低(亢進)",range:"< 0.34",color:C.amber},{label:"偏高(低下)",range:"> 5.60",color:C.amber}],yourValue:"1.979 uIU/mL",yourStatus:"ok",tips:["甲狀腺功能完全正常","每年追蹤一次即可"]},
];

export default function HealthJournal(){
  const [tab,setTab]=useState("home");
  const [recordTab,setRecordTab]=useState("glucose");
  const [selectedKnowledge,setSelectedKnowledge]=useState(null);
  const [trendItem,setTrendItem]=useState("glucose");
  const [toast,setToast]=useState("");
  const [loading,setLoading]=useState(false);
  const [apiKey,setApiKey]=useState(localStorage.getItem("hj_apikey")||"");

  // 後端資料
  const [labHistory,setLabHistory]=useState([]);
  const [glucoseHistory,setGlucoseHistory]=useState([]);
  const [bpHistory,setBpHistory]=useState([]);
  const [weightHistory,setWeightHistory]=useState([]);
  const [hospitalList,setHospitalList]=useState(
    JSON.parse(localStorage.getItem("hj_hospitals")||'["台灣新陳代謝科","越南醫院"]')
  );

  // 提醒
  const [reminders,setReminders]=useState([
    {id:"R001",title:"洗牙",icon:"🦷",intervalDays:180,lastDate:"2025-12-03",nextDate:"2026-06-01"},
    {id:"R002",title:"HbA1c追蹤",icon:"🩸",intervalDays:90,lastDate:"2026-05-27",nextDate:"2026-08-27"},
    {id:"R003",title:"腎功能追蹤",icon:"🫘",intervalDays:180,lastDate:"2026-05-27",nextDate:"2026-11-27"},
    {id:"R004",title:"眼底檢查",icon:"👁️",intervalDays:365,lastDate:"2025-05-27",nextDate:"2026-05-27"},
    {id:"R005",title:"心電圖",icon:"💓",intervalDays:365,lastDate:"2025-05-27",nextDate:"2026-05-27"},
  ]);
  const [editReminder,setEditReminder]=useState(null);

  // 表單
  const [glucoseForm,setGlucoseForm]=useState({value:"",unit:"mmol/L",timePoint:"空腹",source:"日常",note:""});
  const [bpForm,setBpForm]=useState({sys:"",dia:"",pulse:"",source:"日常"});
  const [weightForm,setWeightForm]=useState({value:""});

  // 抽血報告解析
  const [labStep,setLabStep]=useState("input"); // input | parsing | confirm | saving
  const [labInputText,setLabInputText]=useState("");
  const [labPhotos,setLabPhotos]=useState([]); // [{dataUrl,file}]
  const [labParsed,setLabParsed]=useState({});
  const [labForm,setLabForm]=useState({date:today(),hospital:"",country:"台灣",fasting:"空腹"});
  const [showPhotoWarning,setShowPhotoWarning]=useState(false);
  const [pendingPhotos,setPendingPhotos]=useState(null);
  const [aiReport,setAiReport]=useState(null);
  const [aiLoading,setAiLoading]=useState(false);
  const [showApiInput,setShowApiInput]=useState(false);
  const photoInputRef=useRef();

  const showToast=(msg)=>{setToast(msg);setTimeout(()=>setToast(""),2800);};

  const saveHospital=(name)=>{
    if(!name||hospitalList.includes(name))return;
    const updated=[name,...hospitalList].slice(0,10);
    setHospitalList(updated);
    localStorage.setItem("hj_hospitals",JSON.stringify(updated));
  };

  const loadData=useCallback(async()=>{
    setLoading(true);
    try{
      const [lab,glu,bp,wt]=await Promise.all([
        api.get("getLabHistory"),
        api.get("getAll",{sheet:"daily_glucose"}),
        api.get("getAll",{sheet:"daily_bp"}),
        api.get("getAll",{sheet:"daily_weight"}),
      ]);
      if(lab?.data)setLabHistory(lab.data);
      if(glu?.data)setGlucoseHistory(glu.data);
      if(bp?.data)setBpHistory(bp.data);
      if(wt?.data)setWeightHistory(wt.data);
    }catch(e){console.log("載入失敗");}
    setLoading(false);
  },[]);

  useEffect(()=>{loadData();},[loadData]);

  // 儲存血糖
  const saveGlucose=async()=>{
    if(!glucoseForm.value){showToast("⚠️ 請輸入血糖值");return;}
    const mgdl=toMgdl(glucoseForm.value,glucoseForm.unit);
    const now=new Date();
    const r=await api.post("append","daily_glucose",{
      date:now.toISOString().split("T")[0],time:now.toTimeString().slice(0,5),
      timePoint:glucoseForm.timePoint,value_mgdl:mgdl,
      value_original:glucoseForm.value,unit_original:glucoseForm.unit,
      source:glucoseForm.source,note:glucoseForm.note,
    });
    if(r?.success){showToast(`✅ 血糖 ${mgdl} mg/dL 已儲存`);setGlucoseForm({value:"",unit:"mmol/L",timePoint:"空腹",source:"日常",note:""});loadData();}
    else showToast("❌ 儲存失敗，請檢查網路");
  };

  const saveBP=async()=>{
    if(!bpForm.sys||!bpForm.dia){showToast("⚠️ 請輸入血壓值");return;}
    const now=new Date();
    const r=await api.post("append","daily_bp",{
      date:now.toISOString().split("T")[0],time:now.toTimeString().slice(0,5),
      systolic:parseInt(bpForm.sys),diastolic:parseInt(bpForm.dia),
      pulse:parseInt(bpForm.pulse)||"",source:bpForm.source,
    });
    if(r?.success){showToast("✅ 血壓已儲存");setBpForm({sys:"",dia:"",pulse:"",source:"日常"});loadData();}
    else showToast("❌ 儲存失敗");
  };

  const saveWeight=async()=>{
    if(!weightForm.value){showToast("⚠️ 請輸入體重");return;}
    const r=await api.post("append","daily_weight",{date:today(),value_kg:parseFloat(weightForm.value)});
    if(r?.success){showToast("✅ 體重已儲存");setWeightForm({value:""});loadData();}
    else showToast("❌ 儲存失敗");
  };

  // 照片處理
  const handlePhotoChange=async(files)=>{
    if(!files||files.length===0)return;
    const newPhotos=[];
    for(const file of Array.from(files).slice(0,5)){
      const dataUrl=await new Promise(res=>{
        const reader=new FileReader();
        reader.onload=e=>res(e.target.result);
        reader.readAsDataURL(file);
      });
      newPhotos.push({dataUrl,file});
    }
    setLabPhotos(prev=>[...prev,...newPhotos].slice(0,5));
  };

  const confirmPhotos=()=>{
    setShowPhotoWarning(false);
    if(pendingPhotos){handlePhotoChange(pendingPhotos);setPendingPhotos(null);}
  };

  // AI 解析報告（文字）
  const parseLabText=async()=>{
    const key=localStorage.getItem("hj_apikey")||apiKey||"";
    if(!key){showToast("⚠️ 請先在設定Tab輸入API金鑰");setTab("setting");return;}
    if(!labInputText.trim()&&labPhotos.length===0){showToast("⚠️ 請先貼上報告文字或上傳照片");return;}
    setLabStep("parsing");

    try{
      let content=[];
      // 加入照片
      labPhotos.forEach(p=>{
        const b64=p.dataUrl.split(",")[1];
        const mime=p.dataUrl.split(";")[0].split(":")[1];
        content.push({type:"image",source:{type:"base64",media_type:mime,data:b64}});
      });
      // 加入文字
      const textPart=labInputText.trim()||"（請從圖片中辨識所有檢驗數值）";
      content.push({type:"text",text:`你是醫療報告解析助手。請從以下報告文字中提取數值，只回傳JSON，不要任何說明文字、不要markdown格式。

欄位對應規則（嚴格按照以下key名稱）：
- hba1c = HbA1c / 糖化血色素 / Hemoglobin A1c
- glucose_ac = Glucose AC / 空腹血糖 / 飯前血糖 / Fasting Glucose
- alt = ALT / SGPT / 丙胺酸轉胺酶
- ast = AST / SGOT / 天門冬胺酸轉胺酶
- hdl = HDL-C / HDL / 高密度脂蛋白
- ldl = LDL-C / LDL / 低密度脂蛋白
- tg = TG / Triglyceride / 三酸甘油酯
- cholesterol = Total Cholesterol / 總膽固醇 / CHOL
- uric_acid = Uric Acid / 尿酸
- creatinine = Creatinine / 肌酸酐（血清值，不是尿液值）
- gfr = GFR / eGFR / MDRD（取第一個數值）
- upcr = UPCR / Protein/Creatinine Ratio / 蛋白肌酸酐比值
- tsh = TSH / 甲狀腺促素
- hb = Hb / Hemoglobin / 血紅素
- wbc = WBC / 白血球
- platelet = Platelet / PLT / 血小板
- rbc = RBC / 紅血球
- hct = Hct / 血球容積
- mcv = MCV
- mch = MCH
- mchc = MCHC

報告內容：
${textPart}

請回傳（只有JSON，沒有其他文字）：
{"date":"偵測到的日期或null","hospital":"偵測到的醫院名稱或null","hba1c":數值或null,"glucose_ac":數值或null,"alt":數值或null,"ast":數值或null,"hdl":數值或null,"ldl":數值或null,"tg":數值或null,"cholesterol":數值或null,"uric_acid":數值或null,"creatinine":數值或null,"gfr":數值或null,"upcr":數值或null,"tsh":數值或null,"hb":數值或null,"wbc":數值或null,"platelet":數值或null,"rbc":數值或null,"hct":數值或null,"mcv":數值或null,"mch":數值或null,"mchc":數值或null,"note":null}
數值只填數字，不要單位。找不到填null。越南單位mmol/L請×18換算為mg/dL。`});

      const res=await fetch(CLAUDE_API,{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content}]})
      });
      const data=await res.json();
      const rawText=data.content?.map(b=>b.text||"").join("")||"{}";
      // 清理並解析JSON - 多重嘗試
      let parsed={};
      try{
        // 嘗試1: 直接解析
        const clean=rawText.replace(/```json|```/g,"").trim();
        parsed=JSON.parse(clean);
      }catch(e1){
        try{
          // 嘗試2: 找{}區間
          const match=rawText.match(/\{[\s\S]*\}/);
          if(match)parsed=JSON.parse(match[0]);
        }catch(e2){
          console.log("JSON parse failed:",rawText.slice(0,200));
          parsed={};
        }
      }
      // 過濾null值，只保留有數值的欄位
      Object.keys(parsed).forEach(k=>{
        if(parsed[k]===null||parsed[k]==="null"||parsed[k]==="")delete parsed[k];
      });

      // 合併到表單
      setLabParsed(parsed);
      setLabForm(prev=>({
        ...prev,
        date:parsed.date||prev.date,
        hospital:parsed.hospital||prev.hospital,
      }));
      setLabStep("confirm");
    }catch(e){
      showToast("❌ 解析失敗，請確認API金鑰或改用文字輸入");
      setLabStep("input");
    }
  };

  // 確認儲存抽血報告
  const saveLabReport=async()=>{
    if(!labForm.hospital){showToast("⚠️ 請輸入醫院名稱");return;}
    setLabStep("saving");
    const data={...labForm,...labParsed,...labForm};
    // labForm 優先（使用者手動修改的）
    LAB_FIELDS.forEach(f=>{
      if(labForm[f.key]!==undefined&&labForm[f.key]!=="")data[f.key]=labForm[f.key];
    });
    const r=await api.post("append","lab_reports",data);
    if(r?.success){
      saveHospital(labForm.hospital);
      showToast("✅ 抽血報告已儲存");
      setLabStep("input");
      setLabInputText("");setLabPhotos([]);
      setLabParsed({});setLabForm({date:today(),hospital:"",country:"台灣",fasting:"空腹"});
      loadData();
    }else{
      showToast("❌ 儲存失敗");
      setLabStep("confirm");
    }
  };

  const updateReminderDate=(id,lastDate)=>{
    setReminders(prev=>prev.map(r=>{
      if(r.id!==id)return r;
      const next=new Date(lastDate);
      next.setDate(next.getDate()+r.intervalDays);
      return{...r,lastDate,nextDate:next.toISOString().split("T")[0]};
    }));
    showToast("✅ 提醒已更新");setEditReminder(null);
  };

  const latestGlucose=glucoseHistory.length>0?glucoseHistory[glucoseHistory.length-1]:null;
  const latestBP=bpHistory.length>0?bpHistory[bpHistory.length-1]:null;
  const latestWeight=weightHistory.length>0?weightHistory[weightHistory.length-1]:null;
  const latestLab=labHistory.length>0?labHistory[labHistory.length-1]:null;
  const overdueReminders=reminders.filter(r=>new Date(r.nextDate)<=new Date());

  // ── 折線圖 ─────────────────────────────────────────────
  const LineChart=({datasets,min=0,max=200,refLines=[],height=120})=>{
    const hasData=datasets&&datasets.some(d=>d.data.length>0);
    if(!hasData)return<div className="empty-state">📊 尚無資料<br/>請先記錄數值</div>;
    const W=320,H=height,P=26;
    const allDates=[...new Set(datasets.flatMap(d=>d.data.map(p=>p.date)))].sort();
    const toY=v=>P+(1-(v-min)/(max-min))*(H-P*2);
    const toX=i=>allDates.length===1?W/2:P+(i/(allDates.length-1))*(W-P*2);
    return(
      <div style={{overflowX:"auto"}}>
        <svg width="100%" viewBox={`0 0 ${W} ${H+28}`} style={{display:"block"}}>
          {[0,0.25,0.5,0.75,1].map(f=>(
            <line key={f} x1={P} y1={toY(min+f*(max-min))} x2={W-P} y2={toY(min+f*(max-min))} stroke={C.border} strokeWidth="1"/>
          ))}
          {[0,0.5,1].map(f=>(
            <text key={f} x={P-3} y={toY(min+f*(max-min))+4} fontSize="8" fill={C.textMuted} textAnchor="end">{Math.round(min+f*(max-min))}</text>
          ))}
          {refLines.map(r=>(
            <g key={r.label}>
              <line x1={P} y1={toY(r.v)} x2={W-P} y2={toY(r.v)} stroke={r.c} strokeWidth="1.5" strokeDasharray="5,3"/>
              <text x={W-P+2} y={toY(r.v)-2} fontSize="8" fill={r.c}>{r.label}</text>
              <text x={P+2} y={toY(r.v)+9} fontSize="8" fill={r.c} opacity="0.7">{r.v}</text>
            </g>
          ))}
          {datasets.map((ds,di)=>{
            if(ds.data.length===0)return null;
            const pts=ds.data.map(p=>{const xi=allDates.indexOf(p.date);return`${toX(xi)},${toY(p.v)}`;}).join(" ");
            return(
              <g key={di}>
                <polyline points={pts} fill="none" stroke={ds.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                {ds.data.map((p,i)=>{
                  const xi=allDates.indexOf(p.date);
                  return(
                    <g key={i}>
                      <circle cx={toX(xi)} cy={toY(p.v)} r="4" fill={ds.color} stroke={C.bg} strokeWidth="2"/>
                      <text x={toX(xi)} y={toY(p.v)-8} fontSize="10" fill={ds.color} textAnchor="middle" fontWeight="bold">{p.v}</text>
                    </g>
                  );
                })}
              </g>
            );
          })}
          {allDates.map((d,i)=>(
            <text key={i} x={toX(i)} y={H+14} fontSize="9" fill={C.textMuted} textAnchor="middle">{fmtDate(d)}</text>
          ))}
        </svg>
      </div>
    );
  };

  // ── 抽血報告輸入 Tab ──────────────────────────────────
  const LabReportTab=()=>{
    // Step 1: 輸入
    if(labStep==="input")return(
      <div>
        <div className="card-title">上傳抽血報告</div>

        {/* API Key */}
        {!apiKey&&(
          <div className="card" style={{marginBottom:12,border:`1px solid ${C.amber}44`}}>
            <div style={{fontSize:12,color:C.amber,marginBottom:8}}>⚠️ 需要 Claude API 金鑰才能解析報告</div>
            <div style={{fontSize:11,color:C.textMuted,marginBottom:8}}>前往「設定」Tab 輸入金鑰，或直接在下方輸入：</div>
            <input className="input-field" type="password" placeholder="sk-ant-..." value={apiKey}
              onChange={e=>setApiKey(e.target.value)} style={{marginBottom:8}}/>
            <button className="btn-primary" onClick={()=>{if(apiKey){localStorage.setItem("hj_apikey",apiKey);showToast("✅ API金鑰已儲存");}else{showToast("⚠️請先輸入金鑰");}}}>儲存金鑰</button>
          </div>
        )}

        {/* 基本資訊 */}
        <div className="card">
          <div className="card-title">基本資訊</div>
          <div className="field-row">
            <div className="field-label">抽血日期 <span className="field-required">必填</span></div>
            <input className="input-field" type="date" value={labForm.date} onChange={e=>setLabForm(f=>({...f,date:e.target.value}))}/>
          </div>
          <div className="field-row">
            <div className="field-label">醫院名稱 <span className="field-required">必填</span></div>
            <div style={{display:"flex",gap:8,marginBottom:6,flexWrap:"wrap"}}>
              {hospitalList.map(h=>(
                <button key={h} className={`btn-sm ${labForm.hospital===h?"active":""}`}
                  onClick={()=>setLabForm(f=>({...f,hospital:h}))}>{h}</button>
              ))}
            </div>
            <input className="input-field" placeholder="或輸入新醫院名稱" value={labForm.hospital}
              onChange={e=>setLabForm(f=>({...f,hospital:e.target.value}))}/>
          </div>
          <div className="grid-2">
            <div>
              <div className="field-label">國家</div>
              <select className="input-field" value={labForm.country} onChange={e=>setLabForm(f=>({...f,country:e.target.value}))}>
                <option>台灣</option><option>越南</option>
              </select>
            </div>
            <div>
              <div className="field-label">空腹狀態</div>
              <select className="input-field" value={labForm.fasting} onChange={e=>setLabForm(f=>({...f,fasting:e.target.value}))}>
                <option>空腹</option><option>非空腹</option><option>不確定</option>
              </select>
            </div>
          </div>
        </div>

        {/* 貼上文字 */}
        <div className="card">
          <div className="card-title">📋 貼上報告文字（建議優先使用）</div>
          <div style={{fontSize:12,color:C.green,marginBottom:10,padding:"8px 10px",background:"rgba(46,204,138,0.08)",borderRadius:8}}>
            💡 文字輸入比照片更省 Token 費用<br/>
            從PDF複製全部文字後長按此區域貼上
          </div>
          <textarea className="paste-area"
            placeholder="長按此處 → 貼上&#10;&#10;範例：&#10;HbA1c: 5.8 %&#10;Glucose AC: 104 mg/dL&#10;ALT: 45 U/L&#10;..."
            value={labInputText}
            onChange={e=>setLabInputText(e.target.value)}
          />
        </div>

        {/* 上傳照片 */}
        <div className="card">
          <div className="card-title">📸 上傳照片（最多5張）</div>
          <div style={{fontSize:12,color:C.amber,marginBottom:10,padding:"8px 10px",background:"rgba(255,179,71,0.08)",borderRadius:8}}>
            ⚠️ 照片解析約消耗 1,000–2,000 tokens/張<br/>有文字版請優先使用文字貼上
          </div>

          {labPhotos.length>0&&(
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
              {labPhotos.map((p,i)=>(
                <div key={i} className="photo-preview">
                  <img src={p.dataUrl} alt={`報告${i+1}`}/>
                  <button className="photo-del" onClick={()=>setLabPhotos(prev=>prev.filter((_,idx)=>idx!==i))}>×</button>
                </div>
              ))}
              {labPhotos.length<5&&(
                <div style={{width:80,height:80,border:`2px dashed ${C.border}`,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:C.textMuted,fontSize:24}}
                  onClick={()=>photoInputRef.current?.click()}>+</div>
              )}
            </div>
          )}

          {labPhotos.length===0&&(
            <div style={{border:`2px dashed ${C.border}`,borderRadius:12,padding:"20px",textAlign:"center",cursor:"pointer"}}
              onClick={()=>{
                setShowPhotoWarning(true);
                setPendingPhotos(null);
              }}>
              <div style={{fontSize:32,marginBottom:8}}>📷</div>
              <div style={{fontSize:14,color:C.textMuted}}>點擊上傳報告照片</div>
              <div style={{fontSize:11,color:C.textMuted,marginTop:4}}>支援多張・台灣/越南格式</div>
            </div>
          )}
          <input ref={photoInputRef} type="file" accept="image/*" multiple style={{display:"none"}}
            onChange={e=>{handlePhotoChange(e.target.files);e.target.value="";}}/>
        </div>

        <button className="btn-primary"
          onClick={parseLabText}
          disabled={!labInputText.trim()&&labPhotos.length===0}>
          🤖 AI 自動解析報告
        </button>
      </div>
    );

    // Step 2: 解析中
    if(labStep==="parsing")return(
      <div style={{textAlign:"center",padding:"60px 20px"}}>
        <div style={{fontSize:48,marginBottom:20}}>🤖</div>
        <div style={{fontSize:16,fontWeight:600,marginBottom:10}}>AI 解析中...</div>
        <div style={{fontSize:13,color:C.textMuted}}>正在辨識報告數值<br/>請稍候約10-20秒</div>
        <div style={{marginTop:20}}><span className="spin" style={{fontSize:24,color:C.green}}>⟳</span></div>
      </div>
    );

    // Step 3: 確認
    if(labStep==="confirm"){
      const merged={...labParsed,...labForm};
      return(
        <div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
            <div style={{fontSize:20}}>✅</div>
            <div>
              <div style={{fontSize:15,fontWeight:700,color:C.green}}>解析完成！請確認數值</div>
              <div style={{fontSize:12,color:C.textMuted}}>可直接修改有誤的欄位</div>
            </div>
          </div>

          {/* 基本資訊確認 */}
          <div className="card">
            <div className="card-title">基本資訊</div>
            {[
              {key:"date",label:"抽血日期",type:"date"},
              {key:"hospital",label:"醫院名稱",type:"hospital"},
              {key:"country",label:"國家",type:"select",options:["台灣","越南"]},
              {key:"fasting",label:"空腹狀態",type:"select",options:["空腹","非空腹","不確定"]},
              {key:"doctor",label:"醫師（選填）",type:"text"},
            ].map(f=>(
              <div key={f.key} className="field-row">
                <div className="field-label">{f.label}</div>
                {f.type==="select"?(
                  <select className="input-field" value={labForm[f.key]||""} onChange={e=>setLabForm(p=>({...p,[f.key]:e.target.value}))}>
                    {f.options.map(o=><option key={o}>{o}</option>)}
                  </select>
                ):f.type==="hospital"?(
                  <>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
                      {hospitalList.map(h=>(
                        <button key={h} className={`btn-sm ${labForm.hospital===h?"active":""}`}
                          onClick={()=>setLabForm(p=>({...p,hospital:h}))}>{h}</button>
                      ))}
                    </div>
                    <input className="input-field" value={labForm.hospital||""} onChange={e=>setLabForm(p=>({...p,hospital:e.target.value}))} placeholder="醫院名稱"/>
                  </>
                ):(
                  <input className="input-field" type={f.type} value={labForm[f.key]||""} onChange={e=>setLabForm(p=>({...p,[f.key]:e.target.value}))} placeholder={f.placeholder}/>
                )}
              </div>
            ))}
          </div>

          {/* 數值確認 */}
          <div className="card">
            <div className="card-title">解析數值（可修改）</div>
            {[
              {key:"hba1c",label:"HbA1c",unit:"%",color:C.amber},
              {key:"glucose_ac",label:"空腹血糖",unit:"mg/dL",color:C.amber},
              {key:"alt",label:"ALT",unit:"U/L",color:C.red},
              {key:"ast",label:"AST",unit:"U/L",color:C.red},
              {key:"hdl",label:"HDL-C",unit:"mg/dL",color:C.green},
              {key:"ldl",label:"LDL-C",unit:"mg/dL",color:C.blue},
              {key:"tg",label:"三酸甘油酯",unit:"mg/dL",color:C.purple},
              {key:"cholesterol",label:"總膽固醇",unit:"mg/dL",color:C.blue},
              {key:"uric_acid",label:"尿酸",unit:"mg/dL",color:C.blue},
              {key:"creatinine",label:"肌酸酐",unit:"mg/dL",color:C.blue},
              {key:"gfr",label:"eGFR",unit:"",color:C.green},
              {key:"upcr",label:"UPCR",unit:"mg/g",color:C.amber},
              {key:"tsh",label:"TSH",unit:"uIU/mL",color:C.green},
              {key:"hb",label:"血紅素 Hb",unit:"g/dL",color:C.red},
              {key:"wbc",label:"WBC",unit:"",color:C.blue},
              {key:"platelet",label:"血小板",unit:"",color:C.purple},
            ].map(f=>{
              const val=labParsed[f.key];
              const hasParsed=val!==null&&val!==undefined&&val!=="";
              return(
                <div key={f.key} className={`confirm-field ${hasParsed?"filled":""}`}>
                  <div>
                    <div style={{fontSize:12,color:hasParsed?f.color:C.textMuted}}>{f.label}</div>
                    {hasParsed&&<div style={{fontSize:11,color:C.textMuted}}>{f.unit}</div>}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    {hasParsed?(
                      <input style={{width:80,background:"transparent",border:`1px solid ${f.color}44`,borderRadius:6,padding:"4px 8px",color:f.color,fontSize:14,fontWeight:700,textAlign:"right",fontFamily:"monospace",outline:"none"}}
                        type="number" value={labParsed[f.key]||""} onChange={e=>setLabParsed(p=>({...p,[f.key]:e.target.value}))}/>
                    ):(
                      <span style={{fontSize:12,color:C.textMuted}}>未偵測到</span>
                    )}
                  </div>
                </div>
              );
            })}
            <div style={{marginTop:12}}>
              <div className="field-label">備註</div>
              <textarea className="input-field" rows={2} style={{resize:"none"}}
                value={labForm.note||""} onChange={e=>setLabForm(p=>({...p,note:e.target.value}))} placeholder="其他備註..."/>
            </div>
          </div>

          <div style={{display:"flex",gap:10,marginBottom:20}}>
            <button className="btn-secondary" style={{flex:1}} onClick={()=>setLabStep("input")}>← 重新輸入</button>
            <button className="btn-primary" style={{flex:2}} onClick={saveLabReport}>💾 確認儲存</button>
          </div>
        </div>
      );
    }

    // Step 4: 儲存中
    if(labStep==="saving")return(
      <div style={{textAlign:"center",padding:"60px 20px"}}>
        <div style={{fontSize:48,marginBottom:20}}>💾</div>
        <div style={{fontSize:16,fontWeight:600}}>儲存中...</div>
        <div style={{marginTop:20}}><span className="spin" style={{fontSize:24,color:C.green}}>⟳</span></div>
      </div>
    );
  };

  // ── 首頁 ───────────────────────────────────────────────
  const HomeTab=()=>(
    <div className="fade-in" style={{padding:"16px 16px 80px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <ShieldIcon size={36}/>
          <div>
            <div style={{display:"flex",alignItems:"baseline",gap:8}}>
              <span style={{fontSize:18,fontWeight:700}}>我的健康日誌</span>
              <span style={{fontSize:11,color:C.green,background:"rgba(46,204,138,0.12)",padding:"2px 7px",borderRadius:10}}>{VERSION}</span>
            </div>
            <div style={{fontSize:12,color:C.textMuted}}>{new Date().toLocaleDateString("zh-TW",{month:"long",day:"numeric",weekday:"short"})}</div>
          </div>
        </div>
        {overdueReminders.length>0&&(
          <div style={{background:C.red,borderRadius:20,padding:"4px 10px",fontSize:12,color:"white"}}>{overdueReminders.length} 項到期</div>
        )}
      </div>
      {loading&&<div style={{textAlign:"center",color:C.textMuted,fontSize:12,marginBottom:12}}><span className="spin">⟳</span> 載入中...</div>}
      <div style={{background:"rgba(255,179,71,0.1)",border:"1px solid rgba(255,179,71,0.3)",borderRadius:12,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:20}}>⚠️</span>
        <div>
          <div style={{fontSize:12,fontWeight:600,color:C.amber}}>糖尿病前期 + 家族史 T2D</div>
          <div style={{fontSize:11,color:C.textMuted}}>HbA1c {latestLab?.hba1c||"5.8"}% · 需積極管理</div>
        </div>
      </div>
      <div style={{fontSize:11,color:C.textMuted,letterSpacing:2,marginBottom:8}}>LATEST VALUES</div>
      <div className="grid-2">
        <div className="card" style={{cursor:"pointer"}} onClick={()=>{setTab("trend");setTrendItem("glucose")}}>
          <div style={{fontSize:11,color:C.textMuted,marginBottom:6}}>🩸 血糖</div>
          {latestGlucose?<>
            <div style={{display:"flex",alignItems:"baseline",gap:6}}>
              <span style={{fontFamily:"'DM Serif Display',serif",fontSize:28,color:C.amber,lineHeight:1}}>{latestGlucose.value_mgdl}</span>
              <span style={{fontSize:12,color:C.textMuted}}>mg/dL</span>
            </div>
            <div style={{fontSize:10,color:C.textMuted,marginTop:4}}>{latestGlucose.timePoint} · {daysSince(latestGlucose.date)}</div>
            <span className={`source-tag ${latestGlucose.source==="醫院"?"source-hospital":"source-daily"}`} style={{marginTop:6,display:"inline-flex"}}>{latestGlucose.source==="醫院"?"🏥 醫院":"🏠 日常"}</span>
          </>:<div style={{fontSize:12,color:C.textMuted,marginTop:8}}>尚無資料</div>}
        </div>
        <div className="card" style={{cursor:"pointer"}} onClick={()=>{setTab("trend");setTrendItem("bp")}}>
          <div style={{fontSize:11,color:C.textMuted,marginBottom:6}}>💓 血壓</div>
          {latestBP?<>
            <div style={{display:"flex",alignItems:"baseline",gap:4}}>
              <span style={{fontFamily:"'DM Serif Display',serif",fontSize:24,color:C.green,lineHeight:1}}>{latestBP.systolic}</span>
              <span style={{fontSize:12,color:C.textMuted}}>/{latestBP.diastolic}</span>
            </div>
            <div style={{fontSize:10,color:C.textMuted,marginTop:4}}>mmHg · {daysSince(latestBP.date)}</div>
            <span className={`source-tag ${latestBP.source==="醫院"?"source-hospital":"source-daily"}`} style={{marginTop:6,display:"inline-flex"}}>{latestBP.source==="醫院"?"🏥 醫院":"🏠 日常"}</span>
          </>:<div style={{fontSize:12,color:C.textMuted,marginTop:8}}>尚無資料</div>}
        </div>
        <div className="card" style={{cursor:"pointer"}} onClick={()=>{setTab("trend");setTrendItem("weight")}}>
          <div style={{fontSize:11,color:C.textMuted,marginBottom:6}}>⚖️ 體重</div>
          {latestWeight?<>
            <div style={{display:"flex",alignItems:"baseline",gap:6}}>
              <span style={{fontFamily:"'DM Serif Display',serif",fontSize:28,lineHeight:1}}>{latestWeight.value_kg}</span>
              <span style={{fontSize:12,color:C.textMuted}}>kg</span>
            </div>
            <div style={{fontSize:10,color:C.textMuted,marginTop:4}}>{daysSince(latestWeight.date)}</div>
          </>:<div style={{fontSize:12,color:C.textMuted,marginTop:8}}>尚無資料</div>}
        </div>
        <div className="card" style={{cursor:"pointer"}} onClick={()=>setSelectedKnowledge(KNOWLEDGE_ITEMS[0])}>
          <div style={{fontSize:11,color:C.textMuted,marginBottom:6}}>📊 HbA1c</div>
          {latestLab?<>
            <div style={{display:"flex",alignItems:"baseline",gap:6}}>
              <span style={{fontFamily:"'DM Serif Display',serif",fontSize:28,color:C.amber,lineHeight:1}}>{latestLab.hba1c}</span>
              <span style={{fontSize:12,color:C.textMuted}}>%</span>
            </div>
            <div style={{fontSize:10,color:C.textMuted,marginTop:4}}>{daysSince(latestLab.date)}</div>
            <span className="status-chip status-warn" style={{marginTop:6,display:"inline-flex"}}>前期範圍</span>
          </>:<div style={{fontSize:12,color:C.textMuted,marginTop:8}}>尚無資料</div>}
        </div>
      </div>
      <div className="card">
        <div className="card-title">快速記錄</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {[{label:"血糖",icon:"🩸",sub:"glucose"},{label:"血壓",icon:"💓",sub:"bp"},{label:"體重",icon:"⚖️",sub:"weight"},{label:"抽血報告",icon:"📋",sub:"lab"},{label:"飲食",icon:"🍱",sub:"meal"},{label:"運動",icon:"🏃",sub:"exercise"}].map(item=>(
            <div key={item.label} onClick={()=>{setTab("record");setRecordTab(item.sub)}}
              style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 12px",fontSize:12,color:C.textMuted,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
              {item.icon} {item.label}
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="card-title">定期健康提醒</div>
        {reminders.map(r=>{
          const isOverdue=new Date(r.nextDate)<=new Date();
          const diffDays=Math.floor((new Date(r.nextDate)-new Date())/86400000);
          return(
            <div key={r.id} className="reminder-item">
              <span style={{fontSize:22}}>{r.icon}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:500}}>{r.title}</div>
                <div style={{fontSize:11,color:C.textMuted}}>下次：{r.nextDate}</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                <span className={`status-chip ${isOverdue?"status-alert":diffDays<=30?"status-warn":"status-ok"}`}>
                  {isOverdue?"到期！":diffDays<=30?`${diffDays}天後`:"待追蹤"}
                </span>
                <button className="btn-sm" onClick={()=>setEditReminder(r)} style={{fontSize:10,padding:"3px 8px"}}>更新日期</button>
              </div>
            </div>
          );
        })}
      </div>
      {editReminder&&(
        <div className="overlay">
          <div className="overlay-sheet">
            <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>{editReminder.icon} {editReminder.title}</div>
            <div style={{fontSize:12,color:C.textMuted,marginBottom:16}}>輸入最近一次檢查日期（{editReminder.intervalDays}天後自動計算下次）</div>
            <div className="field-label">最近一次檢查日期</div>
            <input className="input-field" type="date" id="reminderDateInput" defaultValue={editReminder.lastDate} style={{marginBottom:16}}/>
            <div style={{display:"flex",gap:10}}>
              <button className="btn-secondary" style={{flex:1}} onClick={()=>setEditReminder(null)}>取消</button>
              <button className="btn-primary" style={{flex:2}} onClick={()=>{const v=document.getElementById("reminderDateInput").value;if(v)updateReminderDate(editReminder.id,v);}}>確認更新</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ── 趨勢 ───────────────────────────────────────────────
  const TrendTab=()=>{
    const BTNS=[{key:"glucose",label:"血糖"},{key:"bp",label:"血壓"},{key:"weight",label:"體重"},{key:"lab",label:"抽血指標"}];
    const gDaily=glucoseHistory.filter(r=>r.source!=="醫院").map(r=>({date:r.date,v:parseFloat(r.value_mgdl)}));
    const gHosp=glucoseHistory.filter(r=>r.source==="醫院").map(r=>({date:r.date,v:parseFloat(r.value_mgdl)}));
    const bpDaily=bpHistory.filter(r=>r.source!=="醫院");
    const bpHosp=bpHistory.filter(r=>r.source==="醫院");
    const wtData=weightHistory.map(r=>({date:r.date,v:parseFloat(r.value_kg)}));
    return(
      <div className="fade-in" style={{padding:"16px 16px 80px"}}>
        <div className="section-header">📈 健康趨勢</div>
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          {BTNS.map(t=>(
            <button key={t.key} className={`btn-sm ${trendItem===t.key?"active":""}`}
              style={{flex:1,padding:"8px 4px",fontSize:11}} onClick={()=>setTrendItem(t.key)}>{t.label}</button>
          ))}
        </div>
        {trendItem==="glucose"&&(
          <div className="card">
            <div className="card-title">血糖趨勢</div>
            <div style={{display:"flex",gap:12,marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:12,height:3,background:C.green,borderRadius:2}}/><span style={{fontSize:11,color:C.textMuted}}>🏠 日常</span></div>
              <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:12,height:3,background:C.blue,borderRadius:2}}/><span style={{fontSize:11,color:C.textMuted}}>🏥 醫院</span></div>
            </div>
            <LineChart datasets={[{data:gDaily,color:C.green},{data:gHosp,color:C.blue}]} min={60} max={160}
              refLines={[{v:70,label:"低血糖",c:C.blue},{v:100,label:"前期線",c:C.amber},{v:126,label:"糖尿病",c:C.red}]}/>
          </div>
        )}
        {trendItem==="bp"&&(
          <div className="card">
            <div className="card-title">血壓趨勢（收縮壓）</div>
            <div style={{display:"flex",gap:12,marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:12,height:3,background:C.green,borderRadius:2}}/><span style={{fontSize:11,color:C.textMuted}}>🏠 日常</span></div>
              <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:12,height:3,background:C.blue,borderRadius:2}}/><span style={{fontSize:11,color:C.textMuted}}>🏥 醫院</span></div>
            </div>
            <LineChart datasets={[{data:bpDaily.map(r=>({date:r.date,v:parseInt(r.systolic)})),color:C.green},{data:bpHosp.map(r=>({date:r.date,v:parseInt(r.systolic)})),color:C.blue}]}
              min={80} max={180} refLines={[{v:120,label:"正常上限",c:C.green},{v:130,label:"高血壓1",c:C.amber},{v:140,label:"高血壓2",c:C.red}]}/>
          </div>
        )}
        {trendItem==="weight"&&(
          <div className="card">
            <div className="card-title">體重趨勢</div>
            <LineChart datasets={[{data:wtData,color:C.green}]} min={60} max={90} refLines={[{v:75,label:"目標",c:C.green}]}/>
          </div>
        )}
        {trendItem==="lab"&&(
          <>
            {labHistory.length===0?(
              <div className="empty-state">📋 尚無抽血資料<br/>請至「記錄」→「📋抽血」上傳報告</div>
            ):(
              [{key:"hba1c",label:"HbA1c",unit:"%",color:C.amber,min:4,max:8,refs:[{v:5.7,label:"前期",c:C.amber},{v:6.5,label:"糖尿病",c:C.red}]},
               {key:"alt",label:"ALT",unit:"U/L",color:C.red,min:0,max:100,refs:[{v:44,label:"上限",c:C.amber}]},
               {key:"hdl",label:"HDL-C",unit:"mg/dL",color:C.green,min:20,max:80,refs:[{v:40,label:"男性下限",c:C.amber}]},
               {key:"ldl",label:"LDL-C",unit:"mg/dL",color:C.blue,min:0,max:160,refs:[{v:130,label:"上限",c:C.amber}]},
               {key:"uric_acid",label:"尿酸",unit:"mg/dL",color:C.purple,min:2,max:10,refs:[{v:7.6,label:"上限(男)",c:C.amber}]},
               {key:"creatinine",label:"肌酸酐",unit:"mg/dL",color:C.blue,min:0,max:2,refs:[{v:1.3,label:"上限(男)",c:C.amber}]},
               {key:"tsh",label:"TSH",unit:"uIU/mL",color:C.green,min:0,max:8,refs:[{v:0.34,label:"下限",c:C.amber},{v:5.6,label:"上限",c:C.amber}]},
              ].map(item=>(
                <div key={item.key} className="card" style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                    <span style={{fontSize:13,fontWeight:600,color:item.color}}>{item.label}</span>
                    <span style={{fontSize:11,color:C.textMuted}}>{item.unit}</span>
                  </div>
                  <LineChart datasets={[{data:labHistory.filter(r=>r[item.key]).map(r=>({date:r.date,v:parseFloat(r[item.key])})),color:item.color}]}
                    min={item.min} max={item.max} refLines={item.refs} height={100}/>
                </div>
              ))
            )}
          </>
        )}
      </div>
    );
  };

  // ── 記錄 ───────────────────────────────────────────────
  const RecordTab=()=>{
    const SUBS=[{key:"glucose",label:"🩸血糖"},{key:"bp",label:"💓血壓"},{key:"weight",label:"⚖️體重"},{key:"lab",label:"📋抽血"},{key:"meal",label:"🍱飲食"},{key:"exercise",label:"🏃運動"}];
    return(
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

        {recordTab==="glucose"&&(
          <div className="card">
            <div className="card-title">記錄血糖</div>
            <div style={{marginBottom:12}}>
              <div className="field-label">來源</div>
              <div className="grid-2">
                {["日常","醫院"].map(s=>(
                  <div key={s} className={`time-btn ${glucoseForm.source===s?"selected":""}`} onClick={()=>setGlucoseForm(f=>({...f,source:s}))}>
                    {s==="日常"?"🏠 日常（Accu-Chek）":"🏥 醫院檢查"}
                  </div>
                ))}
              </div>
            </div>
            <div style={{marginBottom:12}}>
              <div className="field-label">時間點</div>
              <div className="grid-3">
                {["空腹","飯後2hr","睡前"].map(tp=>(
                  <div key={tp} className={`time-btn ${glucoseForm.timePoint===tp?"selected":""}`} onClick={()=>setGlucoseForm(f=>({...f,timePoint:tp}))}>{tp}</div>
                ))}
              </div>
            </div>
            <div style={{marginBottom:12}}>
              <div className="field-label">血糖值</div>
              <div style={{display:"flex",gap:8}}>
                <input className="input-field" type="number" step="0.1" placeholder={glucoseForm.unit==="mmol/L"?"例：5.7":"例：104"}
                  value={glucoseForm.value} onChange={e=>setGlucoseForm(f=>({...f,value:e.target.value}))} style={{flex:2}}/>
                <select className="input-field" value={glucoseForm.unit} onChange={e=>setGlucoseForm(f=>({...f,unit:e.target.value}))} style={{flex:1}}>
                  <option>mmol/L</option><option>mg/dL</option>
                </select>
              </div>
              {glucoseForm.value&&(
                <div style={{fontSize:11,color:C.green,marginTop:6}}>≈ {toMgdl(glucoseForm.value,glucoseForm.unit)} mg/dL</div>
              )}
            </div>
            <div style={{marginBottom:16}}>
              <div className="field-label">備註（可選）</div>
              <input className="input-field" placeholder="例：飯後運動30分鐘" value={glucoseForm.note} onChange={e=>setGlucoseForm(f=>({...f,note:e.target.value}))}/>
            </div>
            <button className="btn-primary" onClick={saveGlucose}>儲存</button>
          </div>
        )}

        {recordTab==="bp"&&(
          <div className="card">
            <div className="card-title">記錄血壓</div>
            <div style={{marginBottom:12}}>
              <div className="field-label">來源</div>
              <div className="grid-2">
                {["日常","醫院"].map(s=>(
                  <div key={s} className={`time-btn ${bpForm.source===s?"selected":""}`} onClick={()=>setBpForm(f=>({...f,source:s}))}>
                    {s==="日常"?"🏠 OMRON（在家）":"🏥 醫院量測"}
                  </div>
                ))}
              </div>
            </div>
            <div className="grid-3" style={{marginBottom:12}}>
              {[["收縮壓","SYS",bpForm.sys,v=>setBpForm(f=>({...f,sys:v}))],["舒張壓","DIA",bpForm.dia,v=>setBpForm(f=>({...f,dia:v}))],["心率","PR",bpForm.pulse,v=>setBpForm(f=>({...f,pulse:v}))]].map(([l,p,v,set])=>(
                <div key={l}><div className="field-label">{l}</div><input className="input-field" type="number" placeholder={p} value={v} onChange={e=>set(e.target.value)}/></div>
              ))}
            </div>
            <div style={{background:C.bg,borderRadius:10,padding:10,marginBottom:14,fontSize:12,color:C.textMuted}}>💡 OMRON顯示HIGH表示舒張壓≥90</div>
            <button className="btn-primary" onClick={saveBP}>儲存</button>
          </div>
        )}

        {recordTab==="weight"&&(
          <div className="card">
            <div className="card-title">記錄體重（小米體重計）</div>
            <div style={{marginBottom:16}}>
              <div className="field-label">體重 (kg)</div>
              <input className="input-field" type="number" step="0.1" placeholder="例：75.2" value={weightForm.value} onChange={e=>setWeightForm({value:e.target.value})}/>
            </div>
            <div style={{background:C.bg,borderRadius:10,padding:10,marginBottom:14,fontSize:12,color:C.textMuted}}>💡 建議每天早上空腹量測</div>
            <button className="btn-primary" onClick={saveWeight}>儲存</button>
          </div>
        )}

        {recordTab==="lab"&&<LabReportTab/>}

        {recordTab==="meal"&&(
          <div className="card">
            <div className="card-title">記錄飲食</div>
            <div style={{display:"flex",gap:8,marginBottom:14}}>
              {["早餐","午餐","晚餐","點心"].map(m=>(
                <div key={m} style={{flex:1,textAlign:"center",padding:"10px 4px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,fontSize:12,color:C.textMuted,cursor:"pointer"}}>{m}</div>
              ))}
            </div>
            <div style={{border:`2px dashed ${C.border}`,borderRadius:12,padding:"24px 16px",textAlign:"center",marginBottom:12,cursor:"pointer"}}>
              <div style={{fontSize:32,marginBottom:8}}>📸</div>
              <div style={{fontSize:14,color:C.textMuted}}>拍照 AI 自動分析</div>
              <div style={{fontSize:11,color:C.textMuted,marginTop:4}}>支援越南料理辨識</div>
            </div>
            <input className="input-field" placeholder="或輸入食物名稱" style={{marginBottom:12}}/>
            <button className="btn-primary" onClick={()=>showToast("✅ 飲食記錄已儲存")}>儲存</button>
          </div>
        )}

        {recordTab==="exercise"&&(
          <div className="card">
            <div className="card-title">記錄運動</div>
            <div style={{marginBottom:12}}>
              <div className="field-label">運動類型</div>
              <div className="grid-3">
                {["走路","騎車","游泳","重訓","瑜伽","其他"].map(type=>(
                  <div key={type} className="time-btn" style={{padding:"10px 4px"}}>{type}</div>
                ))}
              </div>
            </div>
            <div className="grid-2" style={{marginBottom:12}}>
              <div><div className="field-label">時長（分鐘）</div><input className="input-field" type="number" placeholder="30"/></div>
              <div><div className="field-label">強度</div><select className="input-field"><option>輕度</option><option>中度</option><option>高強度</option></select></div>
            </div>
            <div style={{background:C.bg,borderRadius:10,padding:10,marginBottom:14,fontSize:12,color:C.green}}>💡 飯後30分鐘走路15分鐘，可降血糖10-15 mg/dL</div>
            <button className="btn-primary" onClick={()=>showToast("✅ 運動記錄已儲存")}>儲存</button>
          </div>
        )}
      </div>
    );
  };

  // ── AI分析 ─────────────────────────────────────────────
  const generateAIReport=async()=>{
    const key=localStorage.getItem("hj_apikey")||apiKey||"";
    if(!key){showToast("⚠️ 請先在設定Tab輸入API金鑰");setTab("setting");return;}
    setAiLoading(true);
    try{
      const res=await fetch(CLAUDE_API,{method:"POST",headers:{
          "Content-Type":"application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,
          messages:[{role:"user",content:`你是個人健康顧問。用繁體中文分析：
病患：張文彬，55歲，父親T2D家族史，越南工作
HbA1c：${latestLab?.hba1c||5.8}%，血糖：${latestGlucose?.value_mgdl||104} mg/dL
ALT：${latestLab?.alt||45}，HDL：${latestLab?.hdl||38.5}
血壓：${latestBP?.systolic||118}/${latestBP?.diastolic||76} mmHg
請提供：1.本週總評 2.三大重點 3.飲食建議3點 4.運動建議 5.鼓勵一句
不用markdown符號`}]})});
      const data=await res.json();
      setAiReport(data.content?.map(b=>b.text||"").join("")||"分析失敗");
    }catch(e){setAiReport("請檢查API金鑰");}
    setAiLoading(false);
  };

  const AITab=()=>(
    <div className="fade-in" style={{padding:"16px 16px 80px"}}>
      <div className="section-header">🤖 AI 健康分析</div>
      {!apiKey&&(
        <div className="card" style={{marginBottom:12,border:`1px solid ${C.amber}44`,cursor:"pointer"}} onClick={()=>setTab("setting")}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:24}}>⚙️</span>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:C.amber}}>尚未設定 API 金鑰</div>
              <div style={{fontSize:11,color:C.textMuted}}>點此前往設定 → 輸入 Claude API Key</div>
            </div>
            <span style={{color:C.textMuted,marginLeft:"auto",fontSize:18}}>›</span>
          </div>
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
        {aiReport?<div style={{fontSize:13,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{aiReport}</div>
          :<div style={{fontSize:13,color:C.textMuted,lineHeight:1.7}}>根據你的健康數據與家族史，提供個人化分析</div>}
      </div>
      <button className="btn-primary" style={{marginBottom:12}} onClick={generateAIReport} disabled={aiLoading}>
        {aiLoading?"⏳ AI 分析中...":"🔍 產生本週AI健康週報"}
      </button>
      <div className="card">
        <div className="card-title">快速問 AI</div>
        <textarea className="input-field" rows={3} placeholder="例：我今天血糖107，有什麼影響？" style={{resize:"none",marginBottom:10}}/>
        <button className="btn-primary">發問</button>
      </div>
    </div>
  );

  // ── 知識庫 ─────────────────────────────────────────────
  const KnowledgeTab=()=>{
    if(selectedKnowledge){
      const item=selectedKnowledge;
      return(
        <div className="fade-in" style={{padding:"16px 16px 80px"}}>
          <button className="btn-secondary" style={{marginBottom:16}} onClick={()=>setSelectedKnowledge(null)}>← 返回</button>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
            <span style={{fontSize:36}}>{item.icon}</span>
            <div><div style={{fontSize:18,fontWeight:700,color:item.color}}>{item.title}</div></div>
          </div>
          <div className="card"><div className="card-title">說明</div><div style={{fontSize:14,lineHeight:1.8}}>{item.desc}</div></div>
          <div className="card">
            <div className="card-title">數值範圍</div>
            {item.levels.map(l=>(
              <div key={l.label} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
                <span style={{fontSize:13}}>{l.label}</span>
                <span style={{fontSize:13,fontWeight:600,color:l.color}}>{l.range}</span>
              </div>
            ))}
          </div>
          <div className="card" style={{border:`1px solid ${item.color}44`}}>
            <div className="card-title">你的數值</div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span style={{fontSize:28,fontFamily:"'DM Serif Display',serif",color:item.color}}>{item.yourValue}</span>
              <span className={`status-chip ${item.yourStatus==="ok"?"status-ok":"status-warn"}`}>{item.yourStatus==="ok"?"✅ 正常":"⚠️ 需注意"}</span>
            </div>
          </div>
          <div className="card">
            <div className="card-title">改善建議</div>
            {item.tips.map((tip,i)=>(
              <div key={i} style={{display:"flex",gap:10,padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
                <span style={{color:C.green,fontWeight:700,minWidth:20}}>{i+1}</span>
                <span style={{fontSize:13,lineHeight:1.7}}>{tip}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return(
      <div className="fade-in" style={{padding:"16px 16px 80px"}}>
        <div className="section-header">📚 健康知識庫</div>
        <div style={{background:"rgba(255,179,71,0.08)",border:"1px solid rgba(255,179,71,0.25)",borderRadius:14,padding:14,marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:700,color:C.amber,marginBottom:6}}>📌 糖尿病前期專區</div>
          <div style={{fontSize:12,color:C.textMuted,lineHeight:1.7}}>HbA1c 5.8% + 家族史 T2D = 高風險群<br/>好消息：糖尿病前期是可逆的，現在介入效果最好！</div>
        </div>
        <div style={{fontSize:11,color:C.textMuted,letterSpacing:1.5,marginBottom:10}}>點擊查看詳細說明</div>
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
                <span style={{color:C.textMuted,fontSize:16}}>›</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };


  // ── 設定 ───────────────────────────────────────────────
  const SettingTab=()=>{
    const [inputKey,setInputKey]=useState(apiKey);
    const [newHospital,setNewHospital]=useState("");
    const saved=!!localStorage.getItem("hj_apikey");
    return(
      <div className="fade-in" style={{padding:"16px 16px 80px"}}>
        <div className="section-header">⚙️ 設定</div>

        {/* API Key */}
        <div className="card">
          <div className="card-title">Claude API 金鑰</div>
          <div style={{fontSize:12,color:C.textMuted,marginBottom:10,lineHeight:1.7}}>
            至 <span style={{color:C.green}}>console.anthropic.com</span> 取得金鑰<br/>
            格式：sk-ant-api03-...
          </div>
          {saved&&<div style={{fontSize:12,color:C.green,marginBottom:8,padding:"6px 10px",background:"rgba(46,204,138,0.1)",borderRadius:8}}>✅ 已儲存金鑰（輸入新金鑰可覆蓋）</div>}
          <div style={{marginBottom:10}}>
            <div className="field-label">API Key</div>
            <input className="input-field" type="password"
              placeholder="sk-ant-api03-..."
              value={inputKey}
              onChange={e=>setInputKey(e.target.value)}
              style={{marginBottom:10}}
            />
            <button className="btn-primary" onClick={()=>{
              if(!inputKey.trim()){showToast("⚠️ 請輸入API金鑰");return;}
              if(!inputKey.startsWith("sk-")){showToast("⚠️ 格式不正確，應以sk-開頭");return;}
              localStorage.setItem("hj_apikey",inputKey.trim());
              setApiKey(inputKey.trim());
              showToast("✅ API金鑰已儲存");
            }}>儲存金鑰</button>
          </div>
          {apiKey&&(
            <button style={{width:"100%",padding:"10px",background:"transparent",border:`1px solid ${C.red}44`,borderRadius:10,color:C.red,fontSize:13,cursor:"pointer",fontFamily:"'Noto Sans TC',sans-serif",marginTop:6}}
              onClick={()=>{localStorage.removeItem("hj_apikey");setApiKey("");setInputKey("");showToast("🗑️ 金鑰已清除");}}>
              清除金鑰
            </button>
          )}
        </div>

        {/* 醫院管理 */}
        <div className="card">
          <div className="card-title">醫院清單管理</div>
          <div style={{marginBottom:12}}>
            {hospitalList.map((h,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
                <span style={{fontSize:14}}>{h}</span>
                <button style={{background:"transparent",border:"none",color:C.red,cursor:"pointer",fontSize:18,padding:"0 4px"}}
                  onClick={()=>{
                    const updated=hospitalList.filter((_,idx)=>idx!==i);
                    setHospitalList(updated);
                    localStorage.setItem("hj_hospitals",JSON.stringify(updated));
                    showToast("🗑️ 已刪除");
                  }}>×</button>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8}}>
            <input className="input-field" placeholder="新增醫院名稱" value={newHospital}
              onChange={e=>setNewHospital(e.target.value)} style={{flex:1}}/>
            <button className="btn-secondary" onClick={()=>{
              if(!newHospital.trim())return;
              const updated=[...hospitalList,newHospital.trim()];
              setHospitalList(updated);
              localStorage.setItem("hj_hospitals",JSON.stringify(updated));
              setNewHospital("");
              showToast("✅ 醫院已新增");
            }}>新增</button>
          </div>
        </div>

        {/* 健康背景 */}
        <div className="card">
          <div className="card-title">健康背景（AI分析用）</div>
          {[
            {label:"年齡",val:"55歲"},
            {label:"性別",val:"男性"},
            {label:"家族史",val:"父親 T2D（第二型糖尿病）"},
            {label:"工作地點",val:"越南"},
            {label:"血糖機",val:"Accu-Chek Guide（mmol/L）"},
            {label:"血壓計",val:"OMRON Connect"},
            {label:"體重計",val:"小米體重計"},
          ].map(item=>(
            <div key={item.label} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
              <span style={{fontSize:13,color:C.textMuted}}>{item.label}</span>
              <span style={{fontSize:13,color:C.text,textAlign:"right",flex:1,marginLeft:12}}>{item.val}</span>
            </div>
          ))}
          <div style={{fontSize:11,color:C.textMuted,marginTop:10}}>以上背景已自動帶入每次AI分析</div>
        </div>

        {/* APP資訊 */}
        <div className="card">
          <div className="card-title">APP 資訊</div>
          {[
            {label:"版本",val:VERSION},
            {label:"後端",val:"Google Sheets"},
            {label:"AI引擎",val:"Claude Sonnet"},
            {label:"資料存儲",val:"localStorage + Sheets"},
          ].map(item=>(
            <div key={item.label} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
              <span style={{fontSize:13,color:C.textMuted}}>{item.label}</span>
              <span style={{fontSize:13,color:C.green}}>{item.val}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const TABS=[
    {key:"home",label:"首頁",icon:<HomeIcon/>},
    {key:"trend",label:"趨勢",icon:<TrendIcon/>},
    {key:"record",label:"記錄",icon:<RecordIcon/>},
    {key:"ai",label:"AI分析",icon:<AIIcon/>},
    {key:"setting",label:"設定",icon:<SettingIcon/>},
  ];

  return(
    <>
      <style>{styles}</style>
      {toast&&<div className="save-toast">{toast}</div>}
      {/* 照片警告 */}
      {showPhotoWarning&&(
        <div className="overlay">
          <div className="overlay-sheet">
            <div style={{fontSize:18,marginBottom:8}}>📸 照片解析提醒</div>
            <div style={{fontSize:14,lineHeight:1.8,marginBottom:16,color:C.text}}>
              每張照片約消耗 <span style={{color:C.amber,fontWeight:700}}>1,000–2,000 tokens</span>
              <br/>建議優先使用「貼上文字」以節省費用
              <br/><br/>確定要用照片解析嗎？
            </div>
            <div style={{display:"flex",gap:10}}>
              <button className="btn-secondary" style={{flex:1}} onClick={()=>{setShowPhotoWarning(false);setPendingPhotos(null);}}>取消</button>
              <button className="btn-primary" style={{flex:2}} onClick={()=>{confirmPhotos();photoInputRef.current?.click();}}>確定上傳照片</button>
            </div>
          </div>
        </div>
      )}
      <div style={{maxWidth:480,margin:"0 auto",minHeight:"100vh",background:C.bg}}>
        {tab==="home"&&<HomeTab/>}
        {tab==="trend"&&<TrendTab/>}
        {tab==="record"&&<RecordTab/>}
        {tab==="ai"&&<AITab/>}
        {tab==="knowledge"&&<KnowledgeTab/>}
        {tab==="setting"&&<SettingTab/>}
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
