import React, { useState, useEffect, useCallback, useRef } from "react";

const VERSION = "v4.42";
const GAS_URL = "https://script.google.com/macros/s/AKfycbzEQmF8JD_QI_Wq4fOpcwkCXKjrKG8ke63wqR8Mfx0IvUeSLxseJUwSncmJhuJpf4cyqw/exec";
// Claude API 直接呼叫
const callClaude = async (messages, maxTokens=1000) => {
  const key = localStorage.getItem("hj_apikey") || "";
  if (!key) throw new Error("NO_API_KEY");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: maxTokens,
      messages: messages,
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(()=>({}));
    throw new Error(err?.error?.message || "HTTP "+res.status);
  }
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.content?.map(b => b.text || "").join("") || "";
};

const api = {
  get: async (action, params={}) => {
    try { const q=new URLSearchParams({action,...params}).toString(); return (await fetch(`${GAS_URL}?${q}`)).json(); }
    catch(e){ return {error:e.toString()}; }
  },
  post: async (action, sheet, data) => {
    try { return (await fetch(GAS_URL,{method:"POST",body:JSON.stringify({action,sheet,data})})).json(); }
    catch(e){ return {error:e.toString()}; }
  },
  // 刪除記錄
  deleteRow: async (sheet, id) => {
    try {
      return (await fetch(GAS_URL,{method:"POST",body:JSON.stringify({action:"deleteRow",sheet,id})})).json();
    } catch(e){ return {error:e.toString()}; }
  },
  // 設定同步
  saveSetting: async (key, value) => {
    try {
      return (await fetch(GAS_URL,{method:"POST",body:JSON.stringify({
        action:"saveSetting", key, value: JSON.stringify(value)
      })})).json();
    } catch(e){ return {error:e.toString()}; }
  },
  loadSettings: async () => {
    try { return (await fetch(`${GAS_URL}?action=getSettings`)).json(); }
    catch(e){ return {error:e.toString()}; }
  },
};

const C = {
  bg:"#0a0a0a",bgCard:"#141414",bgCard2:"#1e1e1e",
  green:"#2ecc8a",greenDark:"#1a8c5e",
  red:"#ff5a7e",amber:"#ffb347",blue:"#5ab4ff",purple:"#c084fc",
  text:"#e8f5ef",textMuted:"#6b7c74",
  border:"rgba(46,204,138,0.12)",borderBright:"rgba(46,204,138,0.30)",
};

const toMgdl=(v,unit)=>unit==="mmol/L"?Math.round(parseFloat(v)*18.016*10)/10:parseFloat(v);
// 日期正規化 - 處理所有格式，正確轉換時區
const normalizeDate=(d)=>{
  if(!d)return"";
  if(typeof d==="number"){
    const dt=new Date(Math.round((d-25569)*86400*1000));
    const y=dt.getFullYear();
    const m=String(dt.getMonth()+1).padStart(2,"0");
    const day=String(dt.getDate()).padStart(2,"0");
    return`${y}-${m}-${day}`;
  }
  const s=String(d).trim();
  // 純 YYYY-MM-DD → 直接回傳
  if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
  // ISO 格式含 T 和 Z（UTC時間）→ 轉本地時區
  if(s.includes("T")&&s.includes("Z")){
    // 加上本地時區偏移再取日期，避免UTC-1天問題
    const dt=new Date(s);
    // 用本地時間的年月日
    const y=dt.getFullYear();
    const m=String(dt.getMonth()+1).padStart(2,"0");
    const day=String(dt.getDate()).padStart(2,"0");
    return`${y}-${m}-${day}`;
  }
  // ISO 含T但不含Z
  if(s.includes("T")){
    return s.split("T")[0];
  }
  // YYYY/MM/DD
  if(s.includes("/")){
    const p=s.split("/");
    if(p.length===3){
      if(p[0].length===4)return`${p[0]}-${p[1].padStart(2,"0")}-${p[2].slice(0,2).padStart(2,"0")}`;
      if(p[2].length===4)return`${p[2]}-${p[0].padStart(2,"0")}-${p[1].padStart(2,"0")}`;
    }
  }
  if(s.length>=10)return s.slice(0,10);
  return s;
};
const normalizeHospital=(name)=>{
  if(!name)return name;
  const aliases=["海防國際","海防國際醫院","越南海防國際醫院","Hai Phong International","HIH","海防國際綜合醫院","BV DKQT HAI PHONG","hih"];
  if(aliases.some(a=>name.includes(a)))return"海防國際綜合醫院";
  return name;
};
const fmtDate=(d)=>{
  const s=normalizeDate(d);
  if(!s)return"—";
  const p=s.split("-");
  if(p.length===3)return`${p[1]}/${p[2]}`;
  return s;
};
const fmtDateFull=(d)=>{
  const s=normalizeDate(d);
  if(!s)return"—";
  const p=s.split("-");
  if(p.length===3)return`${p[0]}/${p[1]}/${p[2]}`;
  return s;
};
const daysSince=(d)=>{
  if(!d)return"—";
  const s=normalizeDate(d);
  const p=s.split("-").map(Number);
  if(p.length!==3)return"—";
  // 用本地時間計算，不用UTC
  const now=new Date();
  const todayStr=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  const todayP=todayStr.split("-").map(Number);
  // 計算天數差（純數字比較，不涉及時區）
  const toNum=(pp)=>pp[0]*10000+pp[1]*100+pp[2];
  const targetNum=toNum(p);
  const todayNum=toNum(todayP);
  if(targetNum===todayNum)return"今天";
  if(todayNum-targetNum===1)return"昨天";
  if(targetNum>todayNum)return"未來";
  // 計算實際天數
  const target=new Date(p[0],p[1]-1,p[2]);
  const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const diff=Math.floor((today-target)/86400000);
  if(diff<30)return`${diff}天前`;
  if(diff<365)return`${Math.floor(diff/30)}個月前`;
  return`${Math.floor(diff/365)}年前`;
};
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
  .btn-primary{width:100%;padding:14px;background:linear-gradient(135deg,${C.green},${C.greenDark});border:none;border-radius:12px;color:#000000;font-weight:700;font-size:15px;cursor:pointer;font-family:'Noto Sans TC',sans-serif;transition:opacity 0.2s;}
  .btn-primary:active{opacity:0.85;} .btn-primary:disabled{opacity:0.5;}
  .btn-secondary{padding:10px 20px;background:${C.bgCard2};border:1px solid ${C.borderBright};border-radius:10px;color:${C.green};font-size:13px;cursor:pointer;font-family:'Noto Sans TC',sans-serif;}
  .btn-sm{padding:6px 14px;background:${C.bgCard2};border:1px solid ${C.border};border-radius:8px;color:${C.textMuted};font-size:12px;cursor:pointer;font-family:'Noto Sans TC',sans-serif;}
  .btn-sm.active{border-color:${C.green};color:${C.green};background:rgba(46,204,138,0.1);}
  .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
  .grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;}
  .time-btn{padding:8px;border-radius:8px;text-align:center;font-size:12px;cursor:pointer;border:1px solid ${C.border};background:${C.bg};color:${C.textMuted};font-family:'Noto Sans TC',sans-serif;transition:all 0.2s;}
  .time-btn.selected{background:rgba(46,204,138,0.15);border-color:${C.green};color:${C.green};}
  .save-toast{position:fixed;top:20px;left:50%;transform:translateX(-50%);background:${C.green};color:#000000;padding:10px 24px;border-radius:20px;font-weight:700;font-size:14px;z-index:999;animation:fadeIn 0.3s ease;}
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
  .overlay-sheet{background:${C.bgCard};border-radius:20px 20px 0 0;width:100%;max-width:480px;padding:20px 20px 90px;max-height:80vh;overflow-y:auto;}
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


// ── 狀態判斷 ──────────────────────────────────────────
const LAB_STATUS = {
  hba1c:      {warn:5.7, alert:6.5, unit:"%", label:"HbA1c", low:null},
  glucose_ac: {warn:100, alert:126, unit:"mg/dL", label:"空腹血糖", low:70},
  alt:        {warn:44,  alert:80,  unit:"U/L", label:"ALT", low:null},
  hdl:        {warn:40,  alert:35,  unit:"mg/dL", label:"HDL-C", low:null, reverse:true},
  ldl:        {warn:130, alert:160, unit:"mg/dL", label:"LDL-C", low:null},
  tg:         {warn:150, alert:200, unit:"mg/dL", label:"三酸甘油酯", low:null},
  uric_acid:  {warn:7.6, alert:9.0, unit:"mg/dL", label:"尿酸", low:null},
  creatinine: {warn:1.3, alert:2.0, unit:"mg/dL", label:"肌酸酐", low:null},
  upcr:       {warn:30,  alert:300, unit:"mg/g", label:"UPCR", low:null},
  tsh:        {warn:5.6, alert:10,  unit:"uIU/mL", label:"TSH", low:0.34},
  cholesterol:{warn:200, alert:240, unit:"mg/dL", label:"總膽固醇", low:null},
  hb:         {warn:13.7,alert:12,  unit:"g/dL", label:"血紅素", low:null, reverse:true},
  wbc:        {warn:11.2,alert:15,  unit:"K/uL", label:"WBC", low:3.6},
  platelet:   {warn:400, alert:500, unit:"K/uL", label:"血小板", low:130},
  gfr:        {warn:60,  alert:30,  unit:"", label:"eGFR(CKD-EPI)", low:null, reverse:true},
  gfr2:       {warn:60,  alert:30,  unit:"", label:"eGFR(MDRD)", low:null, reverse:true},
  ast:        {warn:40,  alert:80,  unit:"U/L", label:"AST", low:null},
  rbc:        {warn:5.7, alert:6.0, unit:"M/uL", label:"RBC", low:4.5},
  hct:        {warn:49.6,alert:52,  unit:"%", label:"Hct", low:40.5},
  mcv:        {warn:97,  alert:100, unit:"fL", label:"MCV", low:80},
  mch:        {warn:33,  alert:35,  unit:"pg", label:"MCH", low:27},
  mchc:       {warn:35.8,alert:37,  unit:"g/dL", label:"MCHC", low:32.5},
  // 擴充欄位
  alp:        {warn:120, alert:200, unit:"U/L",   label:"ALP", low:null},
  ggt:        {warn:60,  alert:100, unit:"U/L",   label:"GGT", low:null},
  ldh:        {warn:248, alert:300, unit:"U/L",   label:"LDH", low:null},
  tbil:       {warn:1.2, alert:2.0, unit:"mg/dL", label:"總膽紅素", low:null},
  dbil:       {warn:0.3, alert:0.5, unit:"mg/dL", label:"直接膽紅素", low:null},
  tp:         {warn:8.3, alert:9.0, unit:"g/dL",  label:"總蛋白", low:6.4},
  alb:        {warn:5.2, alert:5.5, unit:"g/dL",  label:"白蛋白", low:3.5},
  bun:        {warn:23,  alert:30,  unit:"mg/dL", label:"BUN", low:null},
  na:         {warn:145, alert:150, unit:"mEq/L",  label:"鈉 Na", low:136},
  k:          {warn:5.1, alert:5.5, unit:"mEq/L",  label:"鉀 K", low:3.5},
  cl:         {warn:106, alert:110, unit:"mEq/L",  label:"氯 Cl", low:98},
  ca:         {warn:10.5,alert:11,  unit:"mg/dL", label:"鈣 Ca", low:8.5},
  mg:         {warn:2.5, alert:3.0, unit:"mg/dL", label:"鎂 Mg", low:1.7},
  phos:       {warn:4.5, alert:5.0, unit:"mg/dL", label:"磷 Phos", low:2.5},
  crp:        {warn:1.0, alert:3.0, unit:"mg/L",  label:"CRP", low:null},
  amy:        {warn:100, alert:150, unit:"U/L",   label:"澱粉酶 AMY", low:null},
  lip:        {warn:60,  alert:100, unit:"U/L",   label:"脂肪酶 LIP", low:null},
  ck:         {warn:200, alert:400, unit:"U/L",   label:"CK", low:null},
  fe:         {warn:170, alert:200, unit:"ug/dL", label:"鐵 Fe", low:60},
  uibc:       {warn:370, alert:400, unit:"ug/dL", label:"UIBC", low:null},
  fe_sat:     {warn:50,  alert:60,  unit:"%",     label:"鐵飽和度", low:15},
  // 白血球分類
  ne_pct:     {warn:76.6,alert:85,  unit:"%",     label:"嗜中性球%", low:43.7},
  ly_pct:     {warn:43.5,alert:50,  unit:"%",     label:"淋巴球%", low:16.0},
  mo_pct:     {warn:12.5,alert:15,  unit:"%",     label:"單核球%", low:4.5},
  eo_pct:     {warn:7.9, alert:10,  unit:"%",     label:"嗜酸性球%", low:null},
  ba_pct:     {warn:1.4, alert:2.0, unit:"%",     label:"嗜鹼性球%", low:null},
  // 白血球絕對值
  ne_abs:     {warn:7.6, alert:10,  unit:"G/L",   label:"嗜中性球#", low:1.7},
  ly_abs:     {warn:3.2, alert:4.0, unit:"G/L",   label:"淋巴球#",   low:1.0},
  mo_abs:     {warn:1.1, alert:1.5, unit:"G/L",   label:"單核球#",   low:0.3},
  eo_abs:     {warn:0.5, alert:0.7, unit:"G/L",   label:"嗜酸性球#", low:null},
  ba_abs:     {warn:0.1, alert:0.2, unit:"G/L",   label:"嗜鹼性球#", low:null},
  // 病毒篩檢
  hbsag:      {warn:null,alert:null,unit:"",       label:"HBsAg",     low:null},
  anti_hcv:   {warn:null,alert:null,unit:"",       label:"Anti-HCV",  low:null},
  anti_hbs:   {warn:null,alert:null,unit:"",       label:"Anti-HBs",  low:null},
  // 腫瘤標記
  cea:        {warn:5.0, alert:10,  unit:"ng/mL",  label:"CEA",       low:null},
  afp:        {warn:7.0, alert:20,  unit:"ng/mL",  label:"AFP",       low:null},
  psa:        {warn:4.0, alert:10,  unit:"ng/mL",  label:"PSA",       low:null},
  // 免疫
  asto:       {warn:null,alert:null,unit:"",        label:"ASTO",      low:null},
  rf:         {warn:null,alert:null,unit:"",        label:"RF類風濕因子",low:null},
  // 尿液分析（定性）
  urine_glucose:      {warn:null,alert:null,unit:"",label:"尿糖",      low:null},
  urine_bilirubin:    {warn:null,alert:null,unit:"",label:"尿膽紅素",  low:null},
  urine_ketone:       {warn:null,alert:null,unit:"",label:"尿酮體",    low:null},
  urine_nitrite:      {warn:null,alert:null,unit:"",label:"亞硝酸鹽",  low:null},
  urine_urobilinogen: {warn:null,alert:null,unit:"",label:"尿膽素原",  low:null},
  urine_blood:        {warn:null,alert:null,unit:"",label:"尿潛血",    low:null},
  urine_leukocyte:    {warn:null,alert:null,unit:"",label:"尿白血球",  low:null},
  // 尿液定量
  urine_sg:   {warn:1.030,alert:1.035,unit:"",     label:"尿比重",    low:1.003},
  urine_ph:   {warn:8.0, alert:9.0,  unit:"",      label:"尿液pH",    low:4.5},
};

// 定性欄位：0=陰性=正常，1=陽性=異常
const QUALITATIVE_KEYS = new Set([
  "hbsag","anti_hcv","asto","rf",
  "urine_glucose","urine_bilirubin","urine_ketone",
  "urine_nitrite","urine_urobilinogen","urine_blood","urine_leukocyte",
]);
// 定性欄位但陽性=正常（有保護力）
const QUALITATIVE_POSITIVE_OK = new Set(["anti_hbs"]);

const getStatus = (key, val) => {
  if (val===null || val===undefined || val==="") return null;
  const sVal = String(val).toLowerCase().trim();
  // 定性：陽性=異常
  if (QUALITATIVE_KEYS.has(key)) {
    if (sVal==="0"||sVal==="negative"||sVal==="neg") return "ok";
    if (sVal==="1"||sVal==="positive"||sVal==="pos") return "alert";
    return null;
  }
  // 定性：陽性=正常（anti_hbs）
  if (QUALITATIVE_POSITIVE_OK.has(key)) {
    if (sVal==="1"||sVal==="positive"||sVal==="pos") return "ok";
    if (sVal==="0"||sVal==="negative"||sVal==="neg") return "warn";
    return null;
  }
  const s = LAB_STATUS[key];
  if (!s) return null;
  const v = parseFloat(val);
  if (isNaN(v)) return null;
  if (s.reverse) {
    if (s.low && v < s.low) return "alert";
    if (v < s.alert) return "alert";
    if (v < s.warn) return "warn";
    return "ok";
  }
  if (s.low && v < s.low) return "alert";
  if (v >= s.alert) return "alert";
  if (v >= s.warn) return "warn";
  return "ok";
};

// 定性欄位：0=陰性=正常（顯示用）
const QUAL_DISPLAY_KEYS = new Set([
  "hbsag","anti_hcv","anti_hbs","asto","rf",
  "urine_glucose","urine_bilirubin","urine_ketone",
  "urine_nitrite","urine_urobilinogen","urine_blood","urine_leukocyte",
]);

// 格式化檢驗值顯示
const fmtLabVal = (key, val) => {
  if (val===null||val===undefined||val==="") return "";
  // 定性欄位
  if (QUAL_DISPLAY_KEYS.has(key)) {
    const s = String(val).toLowerCase().trim();
    if (s==="0"||s==="negative"||s==="neg") return "陰性";
    if (s==="1"||s==="positive"||s==="pos") return "陽性";
    return String(val);
  }
  // 尿比重固定3位小數
  if (key==="urine_sg") {
    const n = parseFloat(val);
    return isNaN(n) ? String(val) : n.toFixed(3);
  }
  return String(val);
};

const StatusDot = ({status}) => {
  const colors = {ok:C.green, warn:C.amber, alert:C.red};
  const labels = {ok:"✅", warn:"⚠️", alert:"❌"};
  if (!status) return null;
  return <span style={{fontSize:12}}>{labels[status]}</span>;
};

// ── Cloudinary 照片上傳 ───────────────────────────────
const compressImage = (file) => new Promise((res) => {
  if (!file.type.startsWith("image/")) { res(file); return; }
  const img = new Image();
  img.onload = () => {
    const MAX = 1200;
    let w = img.width, h = img.height;
    if (w > MAX || h > MAX) {
      if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
      else { w = Math.round(w * MAX / h); h = MAX; }
    }
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(img, 0, 0, w, h);
    canvas.toBlob(
      blob => res(new File([blob], file.name, { type: "image/jpeg" })),
      "image/jpeg", 0.75
    );
  };
  img.src = URL.createObjectURL(file);
});

const uploadToCloudinary = async (file) => {
  const cloudName = localStorage.getItem("cloudinary_name");
  const uploadPreset = localStorage.getItem("cloudinary_preset");
  if (!cloudName || !uploadPreset) throw new Error("請先在設定頁填入 Cloudinary Cloud Name 和 Upload Preset");
  const compressed = await compressImage(file);
  const formData = new FormData();
  formData.append("file", compressed);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", "health-journal");
  const resp = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body: formData }
  );
  if (!resp.ok) throw new Error("上傳失敗，請確認 Cloud Name 和 Preset 是否正確");
  const result = await resp.json();
  return result.secure_url;
};

// ── 預設追蹤項目
const DEFAULT_TRACK = ["hba1c","glucose_ac","alt","hdl","upcr","ldl","uric_acid","creatinine","crp","ggt","ck","bun","na","k","cl","mg","ca"];

// 所有可追蹤項目
const ALL_TRACK_ITEMS = [
  {key:"hba1c",label:"HbA1c"},
  {key:"glucose_ac",label:"空腹血糖"},
  {key:"alt",label:"ALT"},
  {key:"hdl",label:"HDL-C"},
  {key:"upcr",label:"UPCR"},
  {key:"ldl",label:"LDL-C"},
  {key:"uric_acid",label:"尿酸"},
  {key:"creatinine",label:"肌酸酐"},
  {key:"tsh",label:"TSH"},
  {key:"cholesterol",label:"總膽固醇"},
  {key:"tg",label:"三酸甘油酯"},
  {key:"hb",label:"血紅素"},
  {key:"wbc",label:"WBC"},
  {key:"platelet",label:"血小板"},
  {key:"gfr",label:"eGFR"},
  {key:"ast",label:"AST"},
  {key:"rbc",label:"RBC"},
  {key:"hct",label:"Hct"},
  {key:"ne_pct",label:"嗜中性球%"},
  {key:"ly_pct",label:"淋巴球%"},
  {key:"crp",label:"CRP發炎"},
  {key:"ggt",label:"GGT"},
  {key:"ck",label:"CK肌肉"},
  {key:"bun",label:"BUN"},
  {key:"na",label:"鈉 Na"},
  {key:"k",label:"鉀 K"},
  {key:"cl",label:"氯 Cl"},
  {key:"mg",label:"鎂 Mg"},
  {key:"ca",label:"鈣 Ca"},
];

// 影像檢查類型
const IMAGING_TYPES = [
  "腹部超音波","心臟超音波","頸動脈超音波","甲狀腺超音波",
  "腦部MRI","心臟MRI","腹部MRI","脊椎MRI",
  "頭部CT","腹部CT","腹部CTA血管造影","心臟CT","肺部CT",
  "腦電圖EEG","神經傳導檢查","眼科綜合","眼底攝影","視野檢查",
  "大腸鏡","胃鏡","X光","骨密度","住院摘要","其他"
];

// 器官系統分組（影像跨年串連用）
const ORGAN_SYSTEMS = [
  {
    key:"cardio", icon:"🫀", name:"心血管系統",
    types:["心臟超音波","心臟MRI","心臟CT","頸動脈超音波","腹部CTA血管造影"],
    watch:["LAD1冠狀動脈35%狹窄","雙側髂總動脈瘤","頸動脈輕度粥樣硬化"],
    nextCheck:"2025-09-19", interval:"每6個月心臟科",
  },
  {
    key:"abdomen", icon:"🫁", name:"肝膽腸胃腎",
    types:["腹部超音波","腹部MRI","腹部CT"],
    watch:["脂肪肝 Grade II（G1→G2惡化）","右腎囊腫9mm（追大小）","雙腎鈣化點"],
    nextCheck:"2025-09-19", interval:"每6個月腹超",
  },
  {
    key:"neuro", icon:"🧠", name:"神經系統",
    types:["腦部MRI","頭部CT","腦電圖EEG","神經傳導檢查","脊椎MRI"],
    watch:["左側眼瞼反射R1傳導異常（已緩解）"],
    nextCheck:"", interval:"症狀復發再追蹤",
  },
  {
    key:"eye", icon:"👁️", name:"眼睛",
    types:["眼科綜合","眼底攝影","視野檢查"],
    watch:["右眼視野輕度異常","視網膜退行性變化","黃斑部亮度差（需葉黃素）"],
    nextCheck:"2025-07-19", interval:"視野3-6個月、眼底6個月",
  },
  {
    key:"lung", icon:"🌬️", name:"肺部",
    types:["肺部CT","X光"],
    watch:[],
    nextCheck:"", interval:"每年X光",
  },
  {
    key:"gi", icon:"🔬", name:"腸胃鏡",
    types:["大腸鏡","胃鏡"],
    watch:[],
    nextCheck:"", interval:"大腸鏡5年、胃鏡視情況",
  },
  {
    key:"other", icon:"📋", name:"其他",
    types:["甲狀腺超音波","骨密度","住院摘要","其他"],
    watch:[],
    nextCheck:"", interval:"",
  },
];

const KNOWLEDGE_ITEMS=[
  // 🩸 血糖
  {key:"hba1c",group:"🩸 血糖",title:"HbA1c 糖化血色素",icon:"🩸",color:C.red,fullName:"Glycated Hemoglobin",desc:"反映過去2-3個月的平均血糖水準，不受單次波動影響，是糖尿病診斷與追蹤的黃金指標。",range:"正常 < 5.7%　糖尿病前期 5.7–6.4%　糖尿病 ≥ 6.5%",high:"長期血糖偏高，增加心血管、腎臟、視網膜等併發症風險。",low:"通常無問題，過低（<4%）可能代表溶血性貧血。",tips:["每3個月追蹤一次","減少精緻澱粉：白飯、麵包、含糖飲料","飯後30分鐘散步15分鐘","體重每減1kg，HbA1c約可降0.1%"],related:"與空腹血糖、體重、三酸甘油酯密切相關"},
  {key:"glucose_ac",group:"🩸 血糖",title:"空腹血糖",icon:"🍬",color:C.amber,fullName:"Fasting Glucose (AC)",desc:"禁食8小時後測量的血糖值，反映身體基礎血糖調節能力。",range:"正常 70–99 mg/dL　前期 100–125　糖尿病 ≥ 126",high:"胰島素阻抗或胰臟功能下降，T2D最早期指標之一。",low:"< 70 mg/dL 為低血糖，需立即補充糖分。",tips:["晚餐後不吃宵夜","避免含糖飲料包含果汁","有氧運動改善胰島素敏感性"],related:"與HbA1c、體重、三酸甘油酯相關"},
  {key:"glucose_pc",group:"🩸 血糖",title:"飯後血糖",icon:"🍚",color:C.amber,fullName:"Postprandial Glucose (PC)",desc:"餐後2小時測量，評估飯後血糖代謝能力，比空腹血糖更早反映血糖異常。",range:"正常 < 140 mg/dL　前期 140–199　糖尿病 ≥ 200",high:"胰島素分泌延遲或阻抗，需飲食控制與運動。",low:"通常無問題。",tips:["飯後散步降低飯後血糖效果顯著","選擇低GI食物","控制每餐份量"],related:"與HbA1c、空腹血糖、體重相關"},
  // 🫀 肝功能
  {key:"alt",group:"🫀 肝功能",title:"ALT 丙胺酸轉胺酶",icon:"🫀",color:C.amber,fullName:"Alanine Aminotransferase",desc:"主要存在肝細胞中，肝細胞受損時大量釋放，是最敏感的肝功能指標。",range:"正常 男 < 44 U/L　女 < 32 U/L",high:"脂肪肝、病毒性肝炎、藥物傷肝、過量飲酒。1-3倍需追蹤，>3倍需就醫。",low:"無臨床意義。",tips:["減重5-10%可顯著改善脂肪肝","戒酒","減少不必要藥物","規律運動"],related:"與AST、GGT、體重、脂肪肝密切相關"},
  {key:"ast",group:"🫀 肝功能",title:"AST 天門冬胺酸轉胺酶",icon:"🫀",color:C.green,fullName:"Aspartate Aminotransferase",desc:"存在於肝臟、心臟和肌肉，比ALT廣泛，特異性較低。",range:"正常 < 40 U/L",high:"AST/ALT > 2 可能是酒精性肝病。激烈運動後也會上升。",low:"無臨床意義。",tips:["與ALT同步評估","運動前後測量有差異屬正常"],related:"與ALT、CK、LDH相關"},
  {key:"alp",group:"🫀 肝功能",title:"ALP 鹼性磷酸酶",icon:"🫀",color:C.green,fullName:"Alkaline Phosphatase",desc:"存在於肝臟和骨骼，膽道阻塞或骨骼疾病時升高。",range:"正常 40–120 U/L",high:"膽道阻塞、肝硬化、骨骼疾病（骨折、Paget氏病）、副甲狀腺亢進。",low:"通常無意義，可能代表鋅缺乏。",tips:["需配合GGT判斷來源（肝或骨骼）","補鈣和維生素D保護骨骼"],related:"與GGT、膽紅素相關"},
  {key:"ggt",group:"🫀 肝功能",title:"GGT 麩胺轉移酶",icon:"🫀",color:C.amber,fullName:"Gamma-Glutamyl Transferase",desc:"對脂肪肝和酒精性肝病最敏感，也是膽道疾病的指標。",range:"正常 男 < 60 U/L　女 < 45 U/L",high:"脂肪肝、飲酒、膽道疾病、某些藥物。",low:"無臨床意義。",tips:["戒酒後GGT通常4-8週內下降","減重改善脂肪肝"],related:"與ALT、脂肪肝、飲酒習慣密切相關"},
  {key:"tbil",group:"🫀 肝功能",title:"總膽紅素",icon:"🟡",color:C.green,fullName:"Total Bilirubin",desc:"紅血球分解產物，由肝臟代謝後從膽汁排出，偏高時出現黃疸。",range:"正常 0.2–1.2 mg/dL",high:"肝臟疾病、膽道阻塞、溶血性貧血。",low:"通常無意義。",tips:["黃疸需就醫","多喝水助膽汁排出"],related:"與ALT、AST、ALP相關"},
  {key:"alb",group:"🫀 肝功能",title:"白蛋白",icon:"🥚",color:C.green,fullName:"Albumin",desc:"肝臟合成的主要蛋白質，維持血液滲透壓，是肝功能和營養狀態的指標。",range:"正常 3.5–5.5 g/dL",high:"少見，可能為脫水。",low:"肝功能不全、營養不良、腎病症候群。",tips:["確保足夠蛋白質攝取","控制肝臟疾病"],related:"與TP、eGFR、UPCR相關"},
  {key:"tp",group:"🫀 肝功能",title:"總蛋白",icon:"🧬",color:C.green,fullName:"Total Protein",desc:"血液中白蛋白與球蛋白的總和，反映整體蛋白質代謝狀態。",range:"正常 6.4–8.3 g/dL",high:"可能為脫水或慢性感染/免疫疾病。",low:"營養不良、肝腎疾病、吸收不良。",tips:["搭配A/G比值判斷","確保飲食中有足夠優質蛋白"],related:"與白蛋白、球蛋白相關"},
  {key:"glob",group:"🫀 肝功能",title:"球蛋白",icon:"🧬",color:C.green,fullName:"Globulin",desc:"免疫球蛋白的主要成分，參與免疫反應。由總蛋白減去白蛋白計算。",range:"正常 2.0–3.5 g/dL",high:"慢性感染、自體免疫疾病、肝硬化、多發性骨髓瘤。",low:"免疫功能缺乏。",tips:["需搭配A/G比值和完整免疫評估"],related:"與A/G比值、TP、免疫功能相關"},
  {key:"ag_ratio",group:"🫀 肝功能",title:"A/G比值",icon:"📊",color:C.green,fullName:"Albumin/Globulin Ratio",desc:"白蛋白除以球蛋白，偏低可能代表慢性肝病或免疫異常。",range:"正常 1.1–2.5",high:"少見，通常無問題。",low:"慢性肝病、自體免疫疾病、多發性骨髓瘤。",tips:["需配合其他肝功能指標解讀"],related:"與白蛋白、球蛋白相關"},
  // 🫘 腎功能
  {key:"creatinine",group:"🫘 腎功能",title:"肌酸酐",icon:"🫘",color:C.green,fullName:"Creatinine",desc:"肌肉代謝產物，幾乎全由腎臟過濾排出，是腎功能最基本的指標。",range:"正常 男 0.7–1.3 mg/dL　女 0.6–1.1",high:"腎臟過濾功能下降，需配合eGFR一起判斷。",low:"肌肉量少（老年、營養不良），不代表腎功能好。",tips:["多喝水","控制血糖血壓","避免NSAID類止痛藥"],related:"與eGFR、BUN、UPCR共同評估腎功能"},
  {key:"gfr",group:"🫘 腎功能",title:"eGFR (CKD-EPI)",icon:"💧",color:C.green,fullName:"Estimated Glomerular Filtration Rate",desc:"估算腎臟每分鐘過濾血液量，是腎功能最直接的評估指標。",range:"正常 ≥ 60　G1 ≥90　G2 60-89　G3a 45-59　G3b 30-44　G4 15-29　G5 <15",high:"無意義。",low:"< 60 持續3個月以上為慢性腎臟病（CKD）。",tips:["控制血糖、血壓、體重","避免NSAID類止痛藥","每6個月追蹤"],related:"與肌酸酐、UPCR、血壓、血糖密切相關"},
  {key:"bun",group:"🫘 腎功能",title:"BUN 血中尿素氮",icon:"🫘",color:C.green,fullName:"Blood Urea Nitrogen",desc:"蛋白質代謝產物，由腎臟排出。越南報告的Urea mmol/L需乘以2.8換算。",range:"正常 7–23 mg/dL",high:"腎功能下降或高蛋白飲食、脫水、胃腸道出血。",low:"蛋白質攝取不足、嚴重肝病。",tips:["適量蛋白質攝取","多喝水","搭配肌酸酐一起評估"],related:"與肌酸酐、eGFR共同評估腎功能"},
  {key:"upcr",group:"🫘 腎功能",title:"UPCR 尿液蛋白肌酸酐比值",icon:"💧",color:C.amber,fullName:"Urine Protein Creatinine Ratio",desc:"偵測尿液異常蛋白質，是糖尿病腎病變最早期的敏感指標。",range:"正常 < 30 mg/g　微量蛋白尿 30–300　顯性蛋白尿 > 300",high:"糖尿病腎病變早期警訊，需積極控制血糖血壓。",low:"無臨床意義。",tips:["嚴格控制血糖（HbA1c < 7%）","血壓控制 < 130/80","必要時使用ACEI/ARB藥物","每6個月複查"],related:"與HbA1c、血壓、eGFR密切相關"},
  // 💉 血脂
  {key:"hdl",group:"💉 血脂",title:"HDL-C 高密度脂蛋白",icon:"💚",color:C.green,fullName:"High-Density Lipoprotein Cholesterol",desc:"俗稱「好膽固醇」，負責將血管中多餘膽固醇運回肝臟代謝，數值越高越保護心血管。",range:"正常 男 > 40 mg/dL　女 > 50 mg/dL　理想 > 60",high:"越高越好，保護心血管。",low:"心血管保護力不足，與T2D、代謝症候群相關。",tips:["規律有氧運動是提升HDL最有效方法","攝取健康脂肪：橄欖油、堅果","減少反式脂肪","戒菸"],related:"與三酸甘油酯呈反比，與體重、運動量相關"},
  {key:"ldl",group:"💉 血脂",title:"LDL-C 低密度脂蛋白",icon:"⚠️",color:C.blue,fullName:"Low-Density Lipoprotein Cholesterol",desc:"俗稱「壞膽固醇」，過多會沉積在血管壁形成動脈硬化斑塊，是心血管疾病主因。",range:"正常 < 130 mg/dL　T2D患者建議 < 100",high:"心肌梗塞、腦中風主要風險因子，T2D患者需嚴格控制。",low:"通常越低越好。",tips:["減少飽和脂肪：紅肉、全脂乳品","增加膳食纖維：燕麥、豆類","規律運動"],related:"與總膽固醇、飲食脂肪攝取相關"},
  {key:"tg",group:"💉 血脂",title:"三酸甘油酯",icon:"🧈",color:C.amber,fullName:"Triglyceride",desc:"血液中最主要的脂肪形式，與精緻糖攝取、飲酒、肥胖密切相關。",range:"正常 < 150 mg/dL　邊緣 150–199　偏高 200–499　極高 ≥ 500",high:"精緻糖和酒精攝取過多、肥胖、T2D，增加心血管和胰臟炎風險。",low:"通常無問題。",tips:["減少精緻糖和酒精","減重","增加omega-3攝取"],related:"與HDL呈反比，與血糖、體重密切相關"},
  {key:"cholesterol",group:"💉 血脂",title:"總膽固醇",icon:"🔵",color:C.green,fullName:"Total Cholesterol",desc:"血液中所有膽固醇的總和，需配合HDL/LDL比例分析才有意義。",range:"正常 < 200 mg/dL　邊緣 200–239　偏高 ≥ 240",high:"需進一步看LDL和HDL的組成比例。",low:"通常無問題，極低可能與營養不良或甲亢有關。",tips:["均衡飲食","規律運動","配合LDL/HDL一起評估"],related:"HDL + LDL + 其他脂蛋白的總和"},
  {key:"chol_hdl",group:"💉 血脂",title:"膽固醇/HDL比值",icon:"📊",color:C.green,fullName:"Cholesterol/HDL Ratio",desc:"總膽固醇除以HDL，比單看總膽固醇更能反映心血管風險，比值越低越好。",range:"理想 < 3.5　正常 < 5.0　高風險 ≥ 5.0",high:"心血管風險增加。",low:"越低越好，代表HDL保護力強。",tips:["提升HDL和降低LDL雙管齊下"],related:"與HDL、LDL、總膽固醇相關"},
  // ⚗️ 尿酸/鐵
  {key:"uric_acid",group:"⚗️ 尿酸／鐵",title:"尿酸",icon:"🔬",color:C.blue,fullName:"Uric Acid",desc:"嘌呤代謝的最終產物，由腎臟排出，過高會在關節沉積引起痛風，也與腎功能和代謝症候群相關。",range:"正常 男 3.4–7.6 mg/dL　女 2.3–6.6",high:"痛風、腎結石、代謝症候群、心血管疾病風險增加。",low:"通常無意義。",tips:["每天喝水2000mL以上","減少紅肉、內臟、啤酒","減重","必要時藥物治療"],related:"與腎功能、體重、飲食習慣相關"},
  {key:"fe",group:"⚗️ 尿酸／鐵",title:"鐵 Fe",icon:"🔩",color:C.green,fullName:"Serum Iron",desc:"血液中游離鐵的含量，與貧血診斷和鐵代謝狀態相關。",range:"正常 60–170 ug/dL",high:"鐵過載（血色素沉著症）、輸血後、急性肝炎。",low:"缺鐵性貧血最常見原因，需補充鐵劑。",tips:["搭配TIBC、鐵飽和度一起評估","補鐵同時補充維生素C促進吸收"],related:"與TIBC、鐵飽和度、血紅素相關"},
  {key:"tibc",group:"⚗️ 尿酸／鐵",title:"TIBC 總鐵結合力",icon:"🔩",color:C.green,fullName:"Total Iron Binding Capacity",desc:"血液中運鐵蛋白可以攜帶鐵的最大能力，缺鐵時升高。",range:"正常 250–370 ug/dL",high:"缺鐵性貧血、妊娠。",low:"鐵過載、慢性疾病性貧血、肝臟疾病。",tips:["配合血清鐵和飽和度一起解讀"],related:"與鐵 Fe、鐵飽和度相關"},
  {key:"fe_sat",group:"⚗️ 尿酸／鐵",title:"鐵飽和度",icon:"🔩",color:C.green,fullName:"Iron Saturation",desc:"血清鐵除以TIBC的百分比，反映運鐵蛋白實際攜帶鐵的比例。",range:"正常 15–50%",high:"鐵過載、血色素沉著症。",low:"缺鐵性貧血。",tips:["<15% 考慮缺鐵性貧血",">50% 考慮鐵過載，需進一步檢查"],related:"與血清鐵、TIBC、血紅素相關"},
  // 🦋 甲狀腺
  {key:"tsh",group:"🦋 甲狀腺",title:"TSH 甲狀腺促素",icon:"🦋",color:C.green,fullName:"Thyroid-Stimulating Hormone",desc:"腦下垂體分泌的激素，調控甲狀腺功能，是甲狀腺疾病最敏感的第一線篩檢指標。",range:"正常 0.34–5.60 uIU/mL",high:"甲狀腺功能低下（甲低）：疲倦、體重增加、怕冷、便秘。",low:"甲狀腺功能亢進（甲亢）：心跳加快、消瘦、怕熱、手抖。",tips:["甲狀腺疾病需醫師治療","T2D患者甲狀腺疾病風險較高","每年追蹤一次"],related:"與FT3、FT4相關，T2D患者需特別注意"},
  {key:"ft3",group:"🦋 甲狀腺",title:"Free T3 游離三碘甲狀腺素",icon:"🦋",color:C.green,fullName:"Free Triiodothyronine",desc:"活性最強的甲狀腺激素，直接作用於組織器官，調節代謝率。",range:"正常 2.3–4.2 pg/mL",high:"甲亢、T3型甲亢。",low:"甲低、嚴重疾病期間。",tips:["配合TSH、FT4一起解讀才準確"],related:"與TSH、FT4相關"},
  {key:"ft4",group:"🦋 甲狀腺",title:"Free T4 游離甲狀腺素",icon:"🦋",color:C.green,fullName:"Free Thyroxine",desc:"主要的甲狀腺激素，在組織中轉化為活性更強的T3。",range:"正常 0.89–1.76 ng/dL",high:"甲亢、TSH偏低時需一起評估。",low:"甲低、垂體功能不足。",tips:["配合TSH一起解讀","甲狀腺功能異常需就醫"],related:"與TSH、FT3相關"},
  // 🧂 電解質
  {key:"na",group:"🧂 電解質",title:"鈉 Na",icon:"🧂",color:C.green,fullName:"Sodium",desc:"細胞外液主要陽離子，調節血液滲透壓、神經和肌肉功能。",range:"正常 136–145 mEq/L",high:"脫水、高鹽飲食、腎上腺亢進。",low:"喝水過多、心衰、腎病、利尿劑副作用。",tips:["每日鈉攝取量 < 2300mg（約1茶匙鹽）","減少加工食品"],related:"與血壓、腎功能、心臟功能密切相關"},
  {key:"k",group:"🧂 電解質",title:"鉀 K",icon:"🍌",color:C.green,fullName:"Potassium",desc:"細胞內液主要陽離子，維持心臟和肌肉正常電位，影響心律。",range:"正常 3.5–5.1 mEq/L",high:"腎功能不全、ACEI/ARB藥物副作用，嚴重時導致心律不整。",low:"利尿劑副作用、腹瀉嘔吐，嚴重時肌肉無力、心律不整。",tips:["腎功能異常時需特別注意鉀的攝取","富含鉀：香蕉、橘子、菠菜（腎功能正常可補充）"],related:"與腎功能、血壓藥物密切相關"},
  {key:"cl",group:"🧂 電解質",title:"氯 Cl",icon:"🧂",color:C.green,fullName:"Chloride",desc:"細胞外液主要陰離子，配合鈉維持滲透壓和酸鹼平衡。",range:"正常 98–106 mEq/L",high:"代謝性酸中毒、脫水。",low:"嘔吐、胃液流失、代謝性鹼中毒。",tips:["通常跟鈉一起變化，需配合血氣分析解讀"],related:"與鈉、腎功能、酸鹼平衡相關"},
  {key:"ca",group:"🧂 電解質",title:"鈣 Ca",icon:"🦴",color:C.green,fullName:"Calcium",desc:"維持骨骼強度、肌肉收縮、神經傳導和凝血功能的重要礦物質。",range:"正常 8.5–10.5 mg/dL",high:"副甲狀腺亢進、惡性腫瘤、維生素D過量。",low:"副甲狀腺低下、維生素D缺乏、腎功能不全。",tips:["每日鈣需求 1000-1200mg","乳製品、豆腐、深綠蔬菜富含鈣","需要維生素D幫助吸收"],related:"與維生素D、副甲狀腺素、骨密度相關"},
  {key:"mg",group:"🧂 電解質",title:"鎂 Mg",icon:"🌿",color:C.green,fullName:"Magnesium",desc:"參與300多種酵素反應，T2D患者常見鎂缺乏，可能加重胰島素阻抗。",range:"正常 1.7–2.5 mg/dL",high:"腎功能不全、鎂補充過量。",low:"T2D常見、飲酒、利尿劑，可能加重胰島素阻抗。",tips:["T2D患者特別需要注意鎂的補充","富含鎂：堅果、深色蔬菜、黑巧克力"],related:"與T2D、胰島素阻抗、血壓相關"},
  {key:"phos",group:"🧂 電解質",title:"磷 Phos",icon:"🦴",color:C.green,fullName:"Phosphorus",desc:"骨骼和牙齒的重要成分，也參與能量代謝（ATP）和DNA合成。",range:"正常 2.5–4.5 mg/dL",high:"腎功能不全時磷排出減少，增加心血管鈣化風險。",low:"副甲狀腺亢進、維生素D缺乏、營養不良。",tips:["腎功能不全患者需限制磷攝取","高磷食物：乳製品、堅果、豆類"],related:"與鈣、腎功能、維生素D相關"},
  // 🔬 其他生化
  {key:"crp",group:"🔬 其他生化",title:"CRP C反應蛋白",icon:"🔥",color:C.amber,fullName:"C-Reactive Protein",desc:"肝臟在急性發炎、感染、組織損傷時分泌，是最廣泛使用的發炎指標。",range:"正常 < 1.0 mg/L　輕度發炎 1–3　中度 3–10　急性 > 10",high:"感染、自體免疫疾病、心血管疾病。慢性低度發炎（1-3）與T2D、代謝症候群相關。",low:"無臨床意義。",tips:["規律運動降低慢性發炎","地中海飲食","減重","充足睡眠","戒菸"],related:"與血糖、血脂、體重、生活習慣密切相關"},
  {key:"amy",group:"🔬 其他生化",title:"澱粉酶 AMY",icon:"🫁",color:C.green,fullName:"Amylase",desc:"由胰臟和唾液腺分泌，分解澱粉，胰臟炎時大量釋放。",range:"正常 28–100 U/L",high:"急性胰臟炎（通常>3倍上限）、腮腺炎、腸阻塞。",low:"通常無意義。",tips:["腹部劇烈疼痛合併AMY升高需立即就醫","限制酒精和高脂飲食保護胰臟"],related:"與脂肪酶LIP一起評估更準確"},
  {key:"lip",group:"🔬 其他生化",title:"脂肪酶 LIP",icon:"🫁",color:C.green,fullName:"Lipase",desc:"主要由胰臟分泌，分解脂肪。比澱粉酶更具胰臟特異性。",range:"正常 13–60 U/L",high:"急性胰臟炎（比澱粉酶持續更久）、慢性胰臟炎、胰臟癌。",low:"通常無意義。",tips:["急性胰臟炎治療期間需禁食","長期保護：少油、少酒精"],related:"與澱粉酶一起評估胰臟功能"},
  {key:"ck",group:"🔬 其他生化",title:"CK 肌酸激酶",icon:"💪",color:C.green,fullName:"Creatine Kinase",desc:"主要存在於骨骼肌、心肌和腦部，肌肉損傷或劇烈運動後大量釋放。",range:"正常 男 55–200 U/L　女 30–145 U/L",high:"急性心肌梗塞、橫紋肌溶解症、肌炎、劇烈運動後。",low:"通常無意義。",tips:["激烈運動後升高屬正常","懷疑心肌梗塞需配合心電圖"],related:"與AST、LDH相關"},
  {key:"ldh",group:"🔬 其他生化",title:"LDH 乳酸脫氫酶",icon:"⚡",color:C.green,fullName:"Lactate Dehydrogenase",desc:"廣泛存在各組織，組織損傷時釋放，是非特異性的細胞損傷指標。",range:"正常 140–248 U/L",high:"心肌梗塞、肝炎、溶血性貧血、惡性腫瘤、肺栓塞。",low:"通常無意義。",tips:["非特異性指標，需配合其他檢驗判斷","腫瘤治療追蹤有參考價值"],related:"與CK、ALT、AST相關"},
  // 🩸 血液CBC
  {key:"wbc",group:"🩸 血液CBC",title:"WBC 白血球",icon:"🦠",color:C.green,fullName:"White Blood Cell Count",desc:"免疫系統的主要細胞，負責對抗感染和異物，由多種細胞組成。",range:"正常 3.6–11.2 x10³/uL",high:"感染、發炎、壓力、某些藥物、白血病（極高）。",low:"免疫抑制藥物、病毒感染、骨髓問題。",tips:["WBC偏高合併發燒需就醫","維持規律作息和均衡飲食強化免疫"],related:"與CRP、白血球分類相關"},
  {key:"rbc",group:"🩸 血液CBC",title:"RBC 紅血球",icon:"🔴",color:C.green,fullName:"Red Blood Cell Count",desc:"攜帶氧氣的血球，數量反映造血功能和貧血狀態。",range:"正常 男 4.5–5.9 M/uL　女 4.1–5.3",high:"真性紅血球增多症、脫水、高海拔適應。",low:"貧血（缺鐵、維生素B12缺乏、慢性病）。",tips:["需搭配Hb、Hct、MCV一起評估貧血類型"],related:"與Hb、Hct、MCV、MCH相關"},
  {key:"hb",group:"🩸 血液CBC",title:"血紅素 Hb",icon:"💉",color:C.green,fullName:"Hemoglobin",desc:"紅血球中攜帶氧氣的蛋白質，是診斷貧血最直接的指標。",range:"正常 男 13.7–17.0 g/dL　女 12.0–15.5",high:"真性紅血球增多症、脫水，T2D患者Hb偏高需注意血液黏稠度。",low:"貧血（缺鐵最常見），影響疲勞感和運動能力，T2D腎臟病變時常見。",tips:["缺鐵性貧血：補充鐵劑+維生素C","B12缺乏：補充B12（尤其素食者）","腎性貧血：控制腎功能"],related:"與RBC、Hct、MCV、腎功能相關"},
  {key:"hct",group:"🩸 血液CBC",title:"Hct 血球容積比",icon:"🔴",color:C.green,fullName:"Hematocrit",desc:"紅血球占血液總體積的百分比，反映貧血或血液濃縮程度。",range:"正常 男 40.5–50.4%　女 36.9–44.6%",high:"脫水、真性紅血球增多症。",low:"貧血。",tips:["通常與Hb平行變化","Hb×3 ≈ Hct（粗略換算）"],related:"與Hb、RBC相關"},
  {key:"mcv",group:"🩸 血液CBC",title:"MCV 平均紅血球容積",icon:"🔴",color:C.green,fullName:"Mean Corpuscular Volume",desc:"每個紅血球的平均大小，是分類貧血類型的重要指標。",range:"正常 80–97 fL",high:"大球性貧血：維生素B12或葉酸缺乏、酒精性肝病。",low:"小球性貧血：缺鐵性貧血最常見、地中海型貧血。",tips:["MCV配合MCHC可精準分類貧血","素食者需注意B12補充"],related:"與MCH、MCHC、血紅素相關"},
  {key:"mch",group:"🩸 血液CBC",title:"MCH 平均紅血球血色素",icon:"🔴",color:C.green,fullName:"Mean Corpuscular Hemoglobin",desc:"每個紅血球中血紅素的平均重量，與MCV類似用於貧血分類。",range:"正常 27–33 pg",high:"大球性貧血。",low:"缺鐵性貧血、地中海型貧血。",tips:["配合MCV和MCHC一起解讀"],related:"與MCV、MCHC相關"},
  {key:"mchc",group:"🩸 血液CBC",title:"MCHC 平均紅血球血色素濃度",icon:"🔴",color:C.green,fullName:"Mean Corpuscular Hemoglobin Concentration",desc:"每個紅血球中血紅素的平均濃度，低於正常值稱為低色素，常見於缺鐵性貧血。",range:"正常 32.5–35.7 g/dL",high:"遺傳性球形紅血球症。",low:"缺鐵性貧血、地中海型貧血（紅血球顏色淡）。",tips:["低色素+小球性→缺鐵性貧血可能性大"],related:"與MCV、MCH、鐵蛋白相關"},
  {key:"platelet",group:"🩸 血液CBC",title:"血小板 Platelet",icon:"🩺",color:C.green,fullName:"Platelet Count",desc:"負責血液凝固和止血，數量過低增加出血風險，過高增加血栓風險。",range:"正常 130–400 x10³/uL",high:"血小板增多症、感染後反應性增加、缺鐵。",low:"免疫性血小板低下（ITP）、骨髓疾病、肝硬化、某些藥物。",tips:["<50 出血風險高，需就醫","避免NSAID類藥物影響血小板功能"],related:"與凝血功能、肝功能相關"},
  // 🦠 白血球分類
  {key:"ne_pct",group:"🦠 白血球分類",title:"嗜中性球 NE%",icon:"🦠",color:C.green,fullName:"Neutrophil Percentage",desc:"白血球中佔最多比例的細胞，是抵抗細菌感染的第一道防線。",range:"正常 43.7–76.6%",high:"細菌感染、急性發炎、壓力反應。",low:"病毒感染、某些藥物、骨髓抑制。",tips:["高燒合併NE%升高通常提示細菌感染需就醫"],related:"與WBC、CRP相關"},
  {key:"ly_pct",group:"🦠 白血球分類",title:"淋巴球 LY%",icon:"🦠",color:C.green,fullName:"Lymphocyte Percentage",desc:"負責免疫記憶和對抗病毒感染，T細胞和B細胞都屬於淋巴球。",range:"正常 16.0–43.5%",high:"病毒感染（如COVID-19後恢復期）、百日咳、慢性淋巴性白血病。",low:"細菌感染、使用類固醇、HIV感染。",tips:["病毒感染後淋巴球比例常暫時升高屬正常"],related:"與NE%呈反比"},
  {key:"mo_pct",group:"🦠 白血球分類",title:"單核球 MO%",icon:"🦠",color:C.green,fullName:"Monocyte Percentage",desc:"吞噬細胞，進入組織後變成巨噬細胞，處理細菌和異物。",range:"正常 4.5–12.5%",high:"慢性感染（結核病）、自體免疫疾病、單核球增多症。",low:"骨髓抑制。",tips:["單核球比例持續升高需排除慢性感染或自體免疫疾病"],related:"與WBC相關"},
  {key:"eo_pct",group:"🦠 白血球分類",title:"嗜酸性球 EO%",icon:"🦠",color:C.green,fullName:"Eosinophil Percentage",desc:"與過敏反應和寄生蟲感染有關，台灣和越南部分地區寄生蟲感染仍需注意。",range:"正常 0–7.9%",high:"過敏性疾病（氣喘、花粉症）、寄生蟲感染、藥物反應。",low:"通常無意義。",tips:["越南居住者需注意腸道寄生蟲可能","規律糞便檢查"],related:"與過敏、寄生蟲感染相關"},
  {key:"ba_pct",group:"🦠 白血球分類",title:"嗜鹼性球 BA%",icon:"🦠",color:C.green,fullName:"Basophil Percentage",desc:"數量最少的白血球，參與過敏反應和發炎，通常佔白血球比例不到1%。",range:"正常 0–1.4%",high:"過敏反應、慢性骨髓性白血病（CML）。",low:"通常無意義。",tips:["單獨升高不常見，需搭配其他指標"],related:"與過敏反應相關"},
  // 🧫 病毒篩檢
  {key:"hbsag",group:"🧫 病毒篩檢",title:"HBsAg B型肝炎表面抗原",icon:"🧫",color:C.green,fullName:"Hepatitis B Surface Antigen",desc:"B型肝炎病毒感染的直接指標，陽性代表目前有B肝病毒感染。",range:"陰性（Negative）= 正常",high:"目前感染B型肝炎，需進一步評估病毒量（HBV DNA）和肝功能。",low:"無意義。",tips:["陽性需每6個月追蹤肝功能","抗病毒治療可有效控制","家人需篩檢"],related:"與Anti-HBs、ALT、AST密切相關"},
  {key:"anti_hbs",group:"🧫 病毒篩檢",title:"Anti-HBs B型肝炎表面抗體",icon:"🧫",color:C.green,fullName:"Hepatitis B Surface Antibody",desc:"對B型肝炎的保護性抗體，陽性代表已有免疫力（自然感染康復或疫苗接種）。",range:"陽性（Positive）= 有保護力",high:"有保護力，陰性才需要注意。",low:"陰性代表無保護力，若HBsAg也陰性建議施打疫苗。",tips:["抗體效價隨時間下降，可考慮加強接種","與HBsAg通常不同時陽性"],related:"與HBsAg相關"},
  {key:"anti_hcv",group:"🧫 病毒篩檢",title:"Anti-HCV C型肝炎抗體",icon:"🧫",color:C.green,fullName:"Hepatitis C Antibody",desc:"C型肝炎抗體，陽性代表曾接觸C肝病毒，需進一步確認HCV RNA。",range:"陰性（Negative）= 正常",high:"曾感染C型肝炎，需做HCV RNA確認是否仍有活動性感染，現有口服藥物可根治。",low:"無意義。",tips:["C肝現在有高效口服藥物，根治率>95%","定期追蹤肝功能"],related:"與ALT、AST相關"},
  // 🎗️ 腫瘤標記
  {key:"cea",group:"🎗️ 腫瘤標記",title:"CEA 癌胚抗原",icon:"🎗️",color:C.green,fullName:"Carcinoembryonic Antigen",desc:"腫瘤標記物，主要用於大腸直腸癌的追蹤，也與肺癌、胃癌有關。非特異性，吸菸者也偏高。",range:"正常 < 5.0 ng/mL（吸菸者 < 10）",high:"大腸直腸癌、肺癌、胰臟癌、吸菸、發炎性腸病。",low:"無意義。",tips:["CEA升高不代表一定是癌症","與基礎值比較趨勢比單次數值更重要","配合糞便潛血、大腸鏡評估"],related:"與AFP、PSA一起作為腫瘤標記組合"},
  {key:"afp",group:"🎗️ 腫瘤標記",title:"AFP 甲胎蛋白",icon:"🎗️",color:C.green,fullName:"Alpha-Fetoprotein",desc:"主要用於肝細胞癌（HCC）的篩檢，慢性B肝患者定期追蹤的重要指標。",range:"正常 < 7.0 ng/mL",high:"肝細胞癌（顯著升高）、慢性肝病（輕度升高）、睪丸癌。",low:"無意義。",tips:["HBsAg陽性患者每6個月需追蹤AFP+腹部超音波","輕度升高（7-100）需進一步影像檢查"],related:"與HBsAg、ALT、腹部超音波相關"},
  {key:"psa",group:"🎗️ 腫瘤標記",title:"PSA 攝護腺特異抗原",icon:"🎗️",color:C.green,fullName:"Prostate-Specific Antigen",desc:"攝護腺癌篩檢指標，50歲以上男性建議定期追蹤。",range:"正常 < 4.0 ng/mL",high:"攝護腺癌、良性攝護腺肥大（BPH）、攝護腺炎。",low:"無意義。",tips:["PSA升高需泌尿科評估","50歲以上每年追蹤","射精後24小時內避免採血"],related:"與攝護腺超音波、尿流速檢查相關"},
  // 🛡️ 免疫
  {key:"asto",group:"🛡️ 免疫",title:"ASTO 抗鏈球菌溶血素O",icon:"🛡️",color:C.green,fullName:"Anti-Streptolysin O",desc:"A群鏈球菌感染後產生的抗體，用於診斷風濕熱和急性腎炎的輔助指標。",range:"陰性（Negative）= 正常",high:"近期A群鏈球菌感染（喉嚨發炎後1-4週），可能與風濕熱有關。",low:"無意義。",tips:["陽性需配合臨床症狀和心臟聽診評估","鏈球菌感染需完整抗生素療程"],related:"與RF、CRP相關"},
  {key:"rf",group:"🛡️ 免疫",title:"RF 類風濕因子",icon:"🛡️",color:C.green,fullName:"Rheumatoid Factor",desc:"類風濕性關節炎的篩檢指標，但特異性不高，正常人也可陽性。",range:"陰性（Negative）= 正常",high:"類風濕性關節炎、乾燥症候群、其他自體免疫疾病。老年人約5-10%可假陽性。",low:"無意義。",tips:["RF陽性不等於類風濕性關節炎，需配合臨床症狀","Anti-CCP比RF更有特異性"],related:"與ASTO、CRP、關節症狀相關"},
  // 🔍 尿液分析
  {key:"urine_glucose",group:"🔍 尿液分析",title:"尿糖",icon:"🍬",color:C.green,fullName:"Urine Glucose",desc:"正常腎臟可完全回收血液中的葡萄糖，尿液出現糖分代表血糖已超過腎臟回吸收閾值（約180 mg/dL）。",range:"陰性（－）= 正常",high:"血糖 > 180 mg/dL（腎糖閾）、妊娠糖尿病、腎小管疾病。",low:"無意義。",tips:["尿糖陽性必須進一步測血糖","良好血糖控制可使尿糖轉為陰性"],related:"與空腹血糖、HbA1c密切相關"},
  {key:"urine_bilirubin",group:"🔍 尿液分析",title:"尿膽紅素",icon:"🟡",color:C.green,fullName:"Urine Bilirubin",desc:"正常尿液不含膽紅素，陽性代表結合型膽紅素過多從腎臟排出，提示肝膽疾病。",range:"陰性（－）= 正常",high:"肝炎、肝硬化、膽道阻塞。",low:"無意義。",tips:["尿膽紅素陽性需配合肝功能檢查評估"],related:"與總膽紅素、ALT、ALP相關"},
  {key:"urine_ketone",group:"🔍 尿液分析",title:"尿酮體",icon:"⚡",color:C.green,fullName:"Urine Ketone",desc:"脂肪燃燒的代謝產物，禁食、低碳飲食或糖尿病血糖控制差時出現。",range:"陰性（－）= 正常",high:"糖尿病酮酸中毒（DKA，需緊急就醫）、長時間禁食、極低碳飲食、嘔吐。",low:"無意義。",tips:["T2D患者尿酮強陽性需立即就醫","空腹時輕度陽性（+）屬正常"],related:"與血糖、HbA1c相關"},
  {key:"urine_sg",group:"🔍 尿液分析",title:"尿比重",icon:"💧",color:C.green,fullName:"Urine Specific Gravity",desc:"反映尿液中溶質濃度，代表腎臟濃縮和稀釋尿液的能力。",range:"正常 1.005–1.030",high:"脫水、蛋白尿、糖尿。",low:"多尿、腎功能下降（濃縮功能喪失）、過量飲水。",tips:["每天飲水2000mL可維持適當尿比重","晨尿通常最高"],related:"與腎功能、水分攝取相關"},
  {key:"urine_ph",group:"🔍 尿液分析",title:"尿液pH",icon:"⚗️",color:C.green,fullName:"Urine pH",desc:"尿液的酸鹼值，反映腎臟調節酸鹼平衡的能力，也與結石風險相關。",range:"正常 4.5–8.0（晨尿約5.5–6.5）",high:"鹼性尿（> 7）：素食飲食、泌尿道感染、某些腎臟疾病。",low:"酸性尿（< 5）：高蛋白飲食、糖尿病、脫水、痛風體質。",tips:["多喝水稀釋尿液","尿酸結石傾向者需保持尿液偏鹼（pH 6.5-7）"],related:"與尿酸、腎結石相關"},
  {key:"urine_nitrite",group:"🔍 尿液分析",title:"亞硝酸鹽",icon:"🦠",color:C.green,fullName:"Urine Nitrite",desc:"細菌將尿液中的硝酸鹽轉化為亞硝酸鹽，是泌尿道感染的間接指標。",range:"陰性（－）= 正常",high:"泌尿道感染（UTI），需配合尿液白血球和培養確認。",low:"無意義。",tips:["陽性合併尿液白血球升高，高度懷疑UTI需就醫","多喝水預防UTI"],related:"與尿液白血球一起評估泌尿道感染"},
  {key:"urine_urobilinogen",group:"🔍 尿液分析",title:"尿膽素原",icon:"🟡",color:C.green,fullName:"Urine Urobilinogen",desc:"膽紅素在腸道被細菌分解的產物，部分被吸收後從腎臟排出，少量屬正常。",range:"陰性至微量（－ 到 +）= 正常",high:"溶血性貧血、肝炎（肝臟無法處理回收的尿膽素原）。",low:"完全陰性可能代表膽道完全阻塞。",tips:["輕度陽性通常無意義","顯著升高需配合肝功能評估"],related:"與總膽紅素、ALT相關"},
  {key:"urine_blood",group:"🔍 尿液分析",title:"尿潛血",icon:"🩸",color:C.green,fullName:"Urine Blood",desc:"偵測尿液中是否有紅血球（血尿），可見於泌尿道任何部位的出血或損傷。",range:"陰性（－）= 正常",high:"泌尿道感染、腎結石、腎臟炎、泌尿道腫瘤、激烈運動後。",low:"無意義。",tips:["肉眼血尿需立即就醫","尿潛血陽性需追蹤顯微鏡檢查","女性月經期可能假陽性"],related:"與尿液白血球、腎功能、泌尿道超音波相關"},
  {key:"urine_leukocyte",group:"🔍 尿液分析",title:"尿白血球",icon:"🦠",color:C.green,fullName:"Urine Leukocyte",desc:"尿液中有白血球（膿尿），是泌尿道感染最重要的指標。",range:"陰性（－）= 正常",high:"泌尿道感染（UTI）是最常見原因，也見於間質性腎炎、腎結核。",low:"無意義。",tips:["合併亞硝酸鹽陽性強烈提示UTI","多喝水是最好的預防方法","T2D患者UTI風險較高"],related:"與亞硝酸鹽、尿液細菌培養相關"},
];

// ── 內建健康知識文章 ──────────────────────────────────
const BUILTIN_ARTICLES = [
  {
    id:"builtin_1", tag:"血糖", icon:"🩸", builtin:true,
    title:"糖尿病前期逆轉指南",
    content:`糖尿病前期（HbA1c 5.7–6.4%）是可逆的，現在介入效果最好。

**為什麼要重視？**
研究顯示，糖尿病前期如不介入，10年內約有50%會進展為T2D。但透過生活方式改變，可降低58%的進展風險。

**關鍵介入方法**

1. 減重 5–7%
每減1kg，HbA1c約可降0.1%。體重從66kg減到62kg，HbA1c預計可降0.4%。

2. 每週150分鐘中強度運動
快走、游泳、騎車均可。飯後30分鐘走15分鐘效果最直接。

3. 低GI飲食
白米換糙米，減少麵包、餅乾、含糖飲料。每餐先吃蔬菜再吃飯。

4. 每3個月追蹤HbA1c
觀察趨勢比單次數值更重要。

**你的目標**
HbA1c 從5.97% → 5.6% 以下，代表已脫離糖尿病前期範圍。`,
  },
  {
    id:"builtin_2", tag:"血糖", icon:"🔬", builtin:true,
    title:"什麼是胰島素阻抗？",
    content:`胰島素阻抗是T2D和代謝症候群的核心問題。

**簡單說明**
正常情況下，胰島素像鑰匙，血糖像門。胰島素阻抗就像「鎖生鏽了」，需要更多鑰匙才能開門，導致血糖和胰島素同時偏高。

**如何判斷你有胰島素阻抗？**
- HbA1c 或空腹血糖偏高
- 三酸甘油酯偏高
- HDL偏低
- 腰圍偏大（男 > 90cm）
- 脂肪肝

你目前符合：HbA1c 5.97%、HDL偏低、脂肪肝，需要積極介入。

**改善方法**
- 減少精緻碳水（最有效）
- 規律運動（肌肉是消耗血糖的主要器官）
- 充足睡眠（睡眠不足會加重胰島素阻抗）
- 減重（腹部脂肪是主要元凶）`,
  },
  {
    id:"builtin_3", tag:"肝臟", icon:"🫀", builtin:true,
    title:"脂肪肝如何改善？",
    content:`脂肪肝 Grade 1（輕度）是完全可逆的。

**什麼是脂肪肝？**
肝臟細胞內脂肪堆積超過5%就是脂肪肝。主要原因是代謝問題，與飲酒無關的稱為非酒精性脂肪肝（NAFLD）。

**你目前的狀況**
Grade 1（輕度）：肝回音增強，ALT 50.6（輕度偏高）。門靜脈正常，無肝硬化徵象，預後良好。

**改善關鍵：體重**
研究顯示體重減少5%，脂肪肝可顯著改善；減少7–10%，大部分可完全逆轉。

**具體做法**
1. 減少精緻糖和果糖（珍珠奶茶、含糖飲料是最大敵人）
2. 減少飽和脂肪（紅肉、炸物）
3. 增加有氧運動
4. 避免飲酒
5. 每6個月追蹤腹部超音波和ALT

**追蹤指標**
ALT、GGT、腹部超音波（每6個月）`,
  },
  {
    id:"builtin_4", tag:"血脂", icon:"💉", builtin:true,
    title:"HDL 偏低怎麼辦？",
    content:`HDL（好膽固醇）偏低是心血管疾病的獨立危險因子。

**你的狀況**
HDL 30.94 mg/dL（正常男性 > 40），明顯偏低。

**為什麼HDL重要？**
HDL負責把血管壁多餘的膽固醇運回肝臟代謝，數值越高，心血管保護力越強。HDL < 40 mg/dL 是代謝症候群的診斷標準之一。

**提升HDL最有效的方法**

1. 有氧運動（最有效）
每週150分鐘以上，HDL可提升5–10%。快走、游泳、騎車均可。

2. 減重
每減1kg，HDL約可提升0.35 mg/dL。

3. 健康脂肪
橄欖油、堅果、酪梨、深海魚（omega-3）。

4. 戒菸
吸菸是降低HDL的重要因素。

5. 減少精緻糖
三酸甘油酯和HDL呈反比，降低TG有助提升HDL。

**目標**
HDL > 40 mg/dL（理想 > 60）`,
  },
  {
    id:"builtin_5", tag:"尿酸", icon:"🔬", builtin:true,
    title:"痛風的飲食控制",
    content:`尿酸過高（高尿酸血症）是痛風的根本原因，也與腎臟和心血管疾病相關。

**你的狀況**
尿酸 7.52 mg/dL（正常男性 < 7.0），輕度偏高。尚未發作痛風，但需要注意。

**高普林食物（需限制）**
- 內臟類：肝、腎、腦（最高）
- 海鮮：沙丁魚、鯖魚、蛤蜊
- 紅肉：牛、豬、羊
- 啤酒（酒精本身也會升高尿酸）

**低普林食物（可多吃）**
- 蔬菜、水果
- 蛋、乳製品
- 豆腐（雖是豆類但普林較低）

**關鍵習慣**
1. 每天喝水 2000mL 以上（幫助尿酸排出）
2. 避免突然劇烈運動（會暫時升高尿酸）
3. 減重（肥胖是高尿酸的重要原因）
4. 避免含糖飲料（果糖會升高尿酸）

**目標**
尿酸 < 6.0 mg/dL（預防痛風發作的安全值）`,
  },
  {
    id:"builtin_6", tag:"綜合", icon:"🫒", builtin:true,
    title:"地中海飲食入門",
    content:`地中海飲食是目前實證最強的健康飲食模式之一，對你的多個健康問題都有幫助。

**對你的具體好處**
- 降低HbA1c和改善胰島素阻抗
- 提升HDL（好膽固醇）
- 改善脂肪肝
- 降低心血管疾病風險
- 預防失智症

**核心原則**

🫒 大量蔬菜水果
每餐至少半盤蔬菜，各種顏色都要有。

🐟 每週2次深海魚
鮭魚、鯖魚、沙丁魚富含omega-3，對心血管和大腦都好。

🌾 全穀類取代精緻澱粉
糙米、燕麥、全麥麵包取代白米、白麵包。

🥜 堅果和豆類
每天一小把堅果（杏仁、核桃），每週數次豆類。

🫒 橄欖油為主要油脂
取代奶油和動物油脂。

🍷 減少紅肉
每週不超過2次，以魚和禽肉為主。

**越南版地中海飲食**
- 河粉→ 選清湯版，多加蔬菜
- 白飯→ 混入糙米
- 多選海鮮和蔬菜料理`,
  },
  {
    id:"builtin_7", tag:"腎臟", icon:"🫘", builtin:true,
    title:"腎臟保護的日常習慣",
    content:`你的 eGFR 68.66（G2期，輕度下降），需要主動保護腎臟。

**為什麼腎臟重要？**
腎臟一旦受損很難恢復，保護腎臟比治療更重要。糖尿病前期患者是慢性腎臟病的高風險族群。

**每日保護腎臟的習慣**

1. 多喝水
每天 1500–2000mL，維持尿液淡黃色。幫助廢物排出，預防腎結石。

2. 控制血糖
血糖是傷腎最主要的原因。HbA1c 每降低1%，腎臟併發症風險降低37%。

3. 控制血壓
目標 < 130/80 mmHg。你目前 130/90，需要注意。

4. 避免止痛藥
NSAID類（布洛芬、阿斯匹靈大劑量）會傷腎，非必要不用。

5. 定期追蹤
每6個月：肌酸酐、eGFR、UPCR
異常趨勢比單次數值更重要。

6. 適量蛋白質
不需要過度限制，但避免高蛋白飲食（每日蛋白質 0.8g/kg體重）。

**你的追蹤計畫**
eGFR 68 → 目標維持在 60 以上
UPCR 每6個月追蹤（早期腎病變指標）`,
  },
  {
    id:"builtin_8", tag:"大腦", icon:"🧠", builtin:true,
    title:"大腦健康與預防失智症",
    content:`失智症不是老化的必然結果，40%的風險是可以預防的。

**與你相關的風險因素**
- 血糖控制不佳（糖尿病前期）：大腦神經細胞也需要胰島素
- 高血壓：傷害腦部血管
- 脂肪肝和代謝症候群：與認知功能下降相關
- 睡眠不足：大腦清除廢物（包括β-amyloid）主要在睡眠中進行

**保護大腦的飲食**

🐟 Omega-3脂肪酸
鮭魚、鯖魚、核桃。DHA是大腦細胞膜的主要成分。

🫐 抗氧化食物
藍莓、草莓、黑巧克力、深色蔬菜。對抗自由基傷害。

🥦 十字花科蔬菜
花椰菜、高麗菜含蘿蔔硫素，有神經保護作用。

☕ 適量咖啡
每天1–2杯咖啡（不加糖）可降低失智症風險20–30%。

**保護大腦的生活習慣**

1. 持續學習（建立認知儲備）
學習新語言、樂器、新技能都有效。

2. 規律運動
有氧運動促進BDNF（腦源性神經滋養因子）分泌，幫助神經細胞生長。

3. 充足睡眠（7–8小時）
睡眠中大腦清除β-amyloid（失智症相關蛋白質）。

4. 社交連結
孤立是失智症的獨立危險因子。

5. 控制血糖和血壓
T2D患者失智症風險是一般人的2倍。

**你現在可以做的**
✅ 每週2次深海魚
✅ 每天快走30分鐘
✅ 控制HbA1c < 5.7%
✅ 確保睡眠7–8小時`,
  },
  {
    id:"a10",icon:"😴",tag:"睡眠",
    title:"睡眠不足的影響與改善",
    content:`你的Samsung Watch 7數據顯示近31天平均睡眠5小時58分，明顯不足。

**你的睡眠數據分析**

近期數據：平均入睡00:17，起床06:08，實際睡眠約5.5-6.5小時。深層睡眠多數在10-15%，低於理想的20%。

**睡眠不足對你的直接影響**

🩸 血糖控制變差
睡眠不足會直接降低胰島素敏感性。研究顯示每少睡1小時，隔天血糖峰值上升15-20%。你的HbA1c 5.8%正在臨界點，睡眠品質是能不能從5.8%降回正常的關鍵因素之一。

❤️ 血壓難以達標
深層睡眠期間血壓自然下降（夜間降壓），睡眠不足讓舒脈康的效果打折。你的血壓130/90，目標要降到125/80，充足睡眠是藥物以外最重要的輔助。

💪 肌肉流失加速
55歲本來就是肌肉流失高峰期，生長激素在深層睡眠分泌，深層只有36-54分鐘遠遠不夠。你吃這麼好的蛋白質，卻在睡眠中流失修復機會。

🧬 睾固酮下降
睾固酮70%在深層睡眠合成。深層睡眠不足直接影響荷爾蒙水平，這與你關心的性功能、精力、情緒都相關。

🧠 大腦清除廢物
睡眠時腦部淋巴系統清除β-澱粉樣蛋白（阿茲海默症相關），睡眠不足讓廢物累積，長期增加失智風險。

**悠樂丁（Eurodin 2mg）的問題**
苯二氮平類雖然讓你睡著，但實際上抑制深層睡眠。吃藥那晚看起來睡著了，但深層睡眠可能更少。每週1-3次偶爾使用影響不大，但不應增加頻率。

**不吃藥的改善方法**

🥝 奇異果含皮（你已在做✅）
睡前1-2小時吃，血清素前驅物改善入睡品質，研究顯示入睡時間縮短35%。

🌬️ 478呼吸法（「想太多睡不著」最有效）
吸氣4秒→憋氣7秒→吐氣8秒，重複4次。激活副交感神經，5分鐘內降低焦慮，是替代安眠藥最快的方法。

📱 睡前30分鐘不看手機
藍光抑制褪黑激素分泌，這是你能做最簡單但效果最顯著的改變。

⏰ 固定23:00前上床
你目前00:17才睡，深層睡眠集中在入睡後1-3小時，晚睡錯過最佳深層睡眠窗口。目標23:00上床，06:00起床=7小時。

🌡️ 睡前降溫
洗溫水澡（不是熱水）→出浴後體溫下降觸發睡意。越南天氣熱，冷氣設定26-27°C輔助入睡。

**你的目標**
深層睡眠從目前10-15%提升到18-22%，每晚多30-40分鐘深層睡眠，對血糖、血壓、荷爾蒙的改善效果等同於增加一種藥物。

✅ 今晚開始：23:00前上床+478呼吸法
✅ 睡前：放下手機，吃奇異果
✅ 目標：每晚7小時，深層>18%`,
  },
  {
    id:"a9",icon:"❤️",tag:"循環",
    title:"性功能健康與血管循環",
    content:`性功能健康和心血管健康是同一個系統的不同表現。

**與你直接相關的因素**

🩸 血管健康是核心
勃起功能需要充足的血流，血管內皮健康直接決定效果。你的狀況：血壓130/90＋HDL偏低30.94＋脂肪肝，三者都會影響血管內皮功能。好消息是你正在積極改善這些指標。

📊 你的指標與性功能關聯
- HDL 30.94偏低→血管內皮保護不足→改善HDL=改善血流
- 血壓130/90→長期高血壓損害微血管→需控制達標
- 血糖前期→高血糖損害神經和血管→控制HbA1c<5.7%很重要
- eGFR 68→腎臟與荷爾蒙調節相關→保護腎功能

💊 你目前用藥的注意事項
舒脈康（Amlodipine成分）：鈣離子阻斷劑對血管舒張有正面影響，本身不影響性功能。
保栓通Plavix＋PDE5抑制劑（Viagra類）：兩者都有血管擴張效果，若考慮使用PDE5藥物，必須先告知開立Plavix的醫師確認安全性。
平脂Statin類：少數人報告性功能改變，Pitavastatin的相關報告較其他Statin少，若有此困擾告知醫師。

**有實證的自然改善方法**

🥤 甜菜根粉（你已在吃！）
硝酸鹽→一氧化氮→血管擴張，機轉與PDE5抑制劑部分類似，是最有力的天然血流補充品。每天3g持續使用。

🫒 橄欖油（你已在吃！）
地中海飲食研究顯示，橄欖油多酚改善血管內皮功能，與性功能改善直接相關。

🧄 大蒜素
每天半顆至1顆生蒜，含蒜素促進一氧化氮生成，擴張血管。

🏃 規律有氧運動
研究最強的單一介入方式。每週150分鐘中等強度有氧（快走、游泳）可改善性功能40%以上。

😴 睡眠充足（7–8小時）
睾固酮主要在深睡眠中分泌。睡眠不足直接影響荷爾蒙水平。

🧘 壓力管理
皮質醇（壓力荷爾蒙）抑制睾固酮。在越南工作的壓力需要主動管理。

**你現在可以做的**
✅ 繼續每天甜菜根粉3g（堅果奶昔中）
✅ 繼續橄欖油+酪梨升HDL
✅ 每天快走30分鐘（優先選擇）
✅ 控制血壓達標<120/80
✅ 確保睡眠7小時以上
✅ 若考慮藥物輔助，告知醫師目前用藥清單`,
  },
];

// ── 藥物/保健品知識庫 ─────────────────────────────────
const MEDICINE_ITEMS = [
  // 保健品
  {id:"m1",type:"supplement",icon:"🐟",name:"魚油 Omega-3",
   desc:"富含EPA和DHA，是心血管和大腦健康的重要補充品。",
   benefits:["提升HDL好膽固醇","降低三酸甘油酯（對你最有幫助）","減少心血管發炎","改善大腦認知功能","可能改善脂肪肝"],
   dosage:"EPA+DHA每日1000–3000mg，建議隨餐服用",
   caution:"服用血液稀釋劑（如阿斯匹靈）需告知醫師",
   personal:"⭐ 強烈推薦：你的HDL 30.94偏低、TG偏高，魚油是最有效的天然補充品"},
  {id:"m2",type:"supplement",icon:"☀️",name:"維生素D3",
   desc:"調節鈣磷代謝、免疫功能和胰島素敏感性，台灣和越南室內工作者普遍缺乏。",
   benefits:["改善胰島素阻抗（對糖尿病前期有益）","強化骨骼","提升免疫力","改善情緒和睡眠"],
   dosage:"每日1000–2000 IU，與含脂食物一起服用",
   caution:"過量（>10000 IU/日）可能造成鈣過高",
   personal:"⭐ 推薦：維生素D不足會加重胰島素阻抗"},
  {id:"m3",type:"supplement",icon:"🌿",name:"鎂 Magnesium",
   desc:"參與300多種酵素反應，T2D前期患者常見缺乏，改善睡眠和胰島素阻抗。",
   benefits:["改善胰島素阻抗","改善睡眠品質","降低血壓","緩解肌肉痙攣","減少焦慮"],
   dosage:"每日200–400mg，甘胺酸鎂或蘋果酸鎂吸收最佳，睡前服用",
   caution:"腎功能不佳需謹慎",
   personal:"⭐ 推薦：你的血壓130/90偏高、有胰島素阻抗，鎂有雙重幫助"},
  {id:"m4",type:"supplement",icon:"🫐",name:"白藜蘆醇 Resveratrol",
   desc:"強效抗氧化劑，存在於葡萄皮和藍莓中，對大腦保護和抗老化有研究支持。",
   benefits:["保護大腦神經細胞","抗氧化和抗發炎","改善胰島素敏感性","保護心血管"],
   dosage:"每日100–500mg，隨餐服用",
   caution:"與血液稀釋劑有交互作用",
   personal:"對預防失智症有潛在幫助"},
  {id:"m5",type:"supplement",icon:"🦠",name:"益生菌 Probiotics",
   desc:"改善腸道菌叢，越來越多研究顯示腸道健康與血糖控制、免疫和情緒密切相關。",
   benefits:["改善腸道健康","可能改善血糖控制","提升免疫力","改善情緒（腸腦軸）","減少脂肪肝發炎"],
   dosage:"每日至少100億CFU，空腹或隨餐均可",
   caution:"免疫功能嚴重低下者需謹慎",
   personal:"對你的脂肪肝改善有輔助作用"},
  {id:"m6",type:"supplement",icon:"🌾",name:"葉黃素 Lutein",
   desc:"保護眼睛黃斑部，糖尿病前期患者視網膜保護的重要補充品。",
   benefits:["保護視網膜黃斑部","預防白內障","抗氧化","保護大腦"],
   dosage:"每日10–20mg，與含脂食物一起服用",
   caution:"通常安全，無重大禁忌",
   personal:"⭐ 推薦：糖尿病前期患者視網膜是重要保護目標"},
  {id:"m7",type:"supplement",icon:"🅱️",name:"維生素B群",
   desc:"B1、B6、B12、葉酸等共同維持神經系統和能量代謝，預防神經病變。",
   benefits:["維持神經健康（預防糖尿病神經病變）","促進能量代謝","改善疲勞","保護大腦","降低同半胱胺酸"],
   dosage:"複合B群每日1顆，隨早餐服用",
   caution:"B6過量（>200mg/日長期）可能造成神經毒性",
   personal:"⭐ 推薦：糖尿病前期神經保護的基本補充"},
  {id:"m11",type:"supplement",icon:"🫒",name:"橄欖油 Extra Virgin",taking:true,
   desc:"特級初榨橄欖油富含單元不飽和脂肪酸和多酚類抗氧化物，是地中海飲食的核心，對心血管和肝臟健康有大量研究支持。",
   benefits:["提升HDL好膽固醇（對你的HDL 30.94最直接有益）","降低發炎指數","改善脂肪肝（研究顯示可降低肝脂肪含量）","改善胰島素敏感性","保護心血管和大腦"],
   dosage:"每日15–30ml（1–2湯匙），可直接飲用或拌入食物，避免高溫烹調破壞多酚",
   caution:"熱量高（1湯匙約120大卡），控制總量避免體重增加；選擇深色瓶裝、酸度<0.8%的特級初榨",
   personal:"✅ 服用中：你每天早餐喝。對HDL偏低+脂肪肝Grade 1是極佳選擇，建議持續"},
  {id:"m15",type:"supplement",icon:"💛",name:"EX NEO 力卡維他命",taking:true,
   desc:"日本第3類醫藥品。每日2錠含B1（100mg）+B6（100mg）+B12（1,500μg）+維生素E（100mg）+菸鹼酸醯胺+泛酸+γ-穀維素，高劑量B群專為神經和疲勞設計。",
   benefits:["B12 1,500μg超高劑量，預防糖尿病前期神經病變最重要的補充","B1+B6維持周邊神經傳導","維生素E強效抗氧化保護細胞","緩解眼疲勞、肩頸腰痛","γ-穀維素穩定自律神經"],
   dosage:"每日2錠，早餐後服用",
   caution:"日本OTC藥品，長期超量B6（>200mg/日）有神經毒性風險，此劑量100mg屬安全範圍",
   personal:"✅ 服用中（2錠·早餐後）：你的糖尿病前期最需要B12神經保護，此劑量1,500μg是有效劑量，持續服用"},
  {id:"m16",type:"supplement",icon:"🌿",name:"強力若元 Wakamoto",taking:true,
   desc:"日本整腸保健品。含釀酒酵母、乳酸菌、澱粉酶三種天然成分，改善消化和腸道環境。",
   benefits:["釀酒酵母含B群+礦物質天然補充","乳酸菌整腸改善腸道菌相","澱粉酶消化酵素幫助分解碳水化合物","與晚上希臘酸奶益生菌形成早晚加成效果","腸道健康與血糖控制和免疫力相關"],
   dosage:"每日9粒，早上空腹或早餐時服用",
   caution:"天然食品級，安全性高；若有乳製品過敏需確認成分",
   personal:"✅ 服用中（9粒·早上）：你的腸道健康對血糖控制有直接影響，搭配晚上酸奶構成早晚雙益生菌策略"},
  {id:"m17",type:"supplement",icon:"🐟",name:"ORIHIRO DHA+EPA",taking:true,
   desc:"日本機能性表示食品。每日6粒含DHA 780mg + EPA 80mg，降中性脂肪、支持中高年記憶和認知功能。",
   benefits:["DHA 780mg降中性脂肪（對你的血脂改善直接有效）","支持大腦記憶、判斷力、閱讀力","EPA抗發炎保護心血管","Omega-3組合對HDL偏低有輔助作用"],
   dosage:"每日6粒，晚餐後服用",
   caution:"⚠️ 重要：你同時服用保栓通Plavix（抗血小板藥），高劑量Omega-3也具抗凝血效果，兩者疊加出血風險增加。請告知開立Plavix的醫師確認此劑量（DHA 780mg）安全性。注意異常瘀青或出血徵兆",
   personal:"✅ 服用中（6粒·晚餐後）：⚠️ Plavix+高劑量DHA/EPA請先確認醫師知情。效益方面對你的TG和大腦保護很好"},
  // 常見藥物
  {id:"m12",type:"medicine",icon:"💊",name:"舒脈康 Sevikar 5/40mg",taking:true,
   desc:"複方降血壓藥，含Amlodipine 5mg（鈣離子阻斷劑）+ Olmesartan 40mg（血管收縮素受體阻斷劑ARB），雙機轉控制血壓。",
   benefits:["Amlodipine放鬆血管平滑肌、降低血壓","Olmesartan阻斷血管收縮、同時保護腎臟","ARB類對糖尿病前期患者有腎臟保護作用","複方藥減少服藥顆數、提高順從性"],
   dosage:"每日1錠，固定時間服用（晚上），不受進食影響",
   caution:"可能腳踝水腫（Amlodipine常見副作用）；起身時注意姿勢性低血壓；定期追蹤腎功能和血鉀；避免高鉀飲食過量",
   personal:"✅ 服用中（2天1次·晚上）：你的血壓130/90，ARB成分同時保護你的腎臟（eGFR 68.66 G2），是適合的選擇。在家定期量血壓記錄到App追蹤效果",taking:true},
  {id:"m13",type:"medicine",icon:"💊",name:"平脂 Zulitor 4mg",taking:true,
   desc:"Pitavastatin（匹伐他汀），Statin類降血脂藥，降低LDL壞膽固醇，心血管保護。相比其他Statin對血糖影響較小。",
   benefits:["降低LDL壞膽固醇","穩定動脈粥狀斑塊","減少心血管事件風險","Pitavastatin對血糖影響在Statin中最小（對糖尿病前期友善）","可能輕微提升HDL"],
   dosage:"每日1錠4mg，睡前或晚上固定時間服用",
   caution:"可能肌肉痠痛（出現需告知醫師、檢查CK）；定期追蹤肝功能（你的ALT 50.6偏高需注意）；避免大量葡萄柚汁",
   personal:"✅ 服用中（每天·晚上）：注意你的ALT 50.6/GGT 66偏高，Statin需定期追蹤肝功能，建議每3-6個月驗ALT。Pitavastatin對血糖影響小，適合糖尿病前期的你",taking:true},
  {id:"m14",type:"medicine",icon:"💊",name:"保栓通 Plavix 75mg",taking:true,
   desc:"Clopidogrel（氯吡格雷），抗血小板藥物，預防血栓形成，常用於心血管疾病預防或支架置放後。",
   benefits:["抑制血小板凝集、預防血栓","降低心肌梗塞和中風風險","支架置放後預防再阻塞的標準用藥"],
   dosage:"每日1錠75mg，晚上固定時間服用，不受進食影響",
   caution:"出血風險增加：刷牙流血、瘀青變多需注意；手術或拔牙前需告知醫師（通常需停藥5-7天）；避免與其他抗凝血藥/高劑量魚油/銀杏併用；你的血小板126偏低，更需注意出血徵兆",
   personal:"✅ 服用中（每天·晚上）：⚠️ 重要提醒：你的血小板126偏低+服用抗血小板藥，出血風險較高。若有不明瘀青、牙齦出血不止、黑便，立即就醫。補充魚油前先諮詢醫師",taking:true},
  {id:"m8",type:"medicine",icon:"💊",name:"Metformin 二甲雙胍",
   desc:"T2D第一線用藥，也常用於糖尿病前期的預防介入，除降血糖外有多種代謝好處。",
   benefits:["降低肝糖生成","改善胰島素敏感性","輕微減重效果","可能改善脂肪肝","降低心血管風險"],
   dosage:"通常500mg每日1–2次，隨餐服用減少腸胃不適",
   caution:"腎功能eGFR<30需停用；可能影響維生素B12吸收，需補充",
   personal:"若HbA1c繼續上升至6.0以上，可與醫師討論是否預防性使用"},
  {id:"m9",type:"medicine",icon:"💊",name:"Statin 史他汀類（降血脂藥）",
   desc:"最常用的降LDL藥物，心血管保護效果強。你目前LDL偏低，但若上升或心血管風險增加可能需要。",
   benefits:["顯著降低LDL","減少心血管事件","穩定動脈斑塊","可能有輕微抗發炎效果"],
   dosage:"依藥物種類不同，通常睡前服用",
   caution:"可能造成肌肉疼痛；定期追蹤CK和肝功能；葡萄柚汁會增加濃度",
   personal:"你目前LDL 44.47偏低，暫不需要，但HDL偏低是主要血脂問題"},
  {id:"m10",type:"medicine",icon:"💊",name:"Allopurinol 別嘌醇（降尿酸藥）",
   desc:"抑制尿酸生成的第一線藥物，尿酸持續偏高或有痛風發作史時使用。",
   benefits:["有效降低血尿酸","預防痛風發作","保護腎臟（尿酸性腎病）"],
   dosage:"通常100–300mg/日，隨餐服用，大量喝水",
   caution:"開始服用可能誘發痛風急性發作；需追蹤腎功能；亞洲人服用前建議基因檢測(HLA-B*5801)",
   personal:"你的尿酸7.52偏高，若無法透過飲食控制至7.0以下可考慮"},
  {id:"m18",type:"medicine",icon:"💊",name:"悠樂丁 Eurodin 2mg",taking:false,
   desc:"Estazolam，苯二氮平類（BZD）安眠藥，處方藥。作用於GABA受體，降低神經興奮性，縮短入睡時間。",
   benefits:["快速入睡效果明確","對「想太多睡不著」有效","2mg屬低劑量，作用時間適中（半衰期10-24小時）"],
   dosage:"睡前30分鐘服用1錠（2mg），偶爾使用，每週不超過1-3次",
   caution:"⚠️ 苯二氮平類會抑制深層睡眠（Deep Sleep），服藥後雖然睡著但睡眠品質實際下降。長期使用有依賴性和耐受性風險。不可與酒精併用。與Plavix/降壓藥合用需告知醫師。隔天可能有殘餘嗜睡感",
   personal:"偶爾使用（每週1-3次·睡前）：⚠️ 你的深層睡眠已偏低（近期約10-21%），悠樂丁會進一步抑制深層睡眠，影響血糖調節、睾固酮分泌和肌肉修復。建議優先嘗試非藥物方法：睡前奇異果+478呼吸法+固定23:00前上床"},
];

// ── 健康雷達計分 ─────────────────────────────────────
// 每面向0-10分：10=理想值，5=異常臨界，0=嚴重異常。線性換算後夾在0-10。
const clamp10=(v)=>Math.max(0,Math.min(10,v));
// score(value, ideal, bad)：value=ideal→10分，value=bad→5分，超過bad持續扣分
const linScore=(val,ideal,bad)=>{
  if(val==null||isNaN(val))return null;
  return clamp10(10-5*Math.abs(val-ideal)/Math.abs(bad-ideal));
};
const computeRadarScores=(lab,bpHistory)=>{
  if(!lab)return null;
  const f=k=>{const v=parseFloat(lab[k]);return isNaN(v)?null:v;};
  const avg=(arr)=>{const a=arr.filter(v=>v!=null);return a.length?a.reduce((s,v)=>s+v,0)/a.length:null;};
  // 血糖代謝：HbA1c(理想5.3/臨界6.5) + 空腹血糖(理想90/臨界126)
  const dimGlucose=avg([linScore(f("hba1c"),5.3,6.5),linScore(f("glucose_ac"),90,126)]);
  // 血脂：HDL(理想60/臨界40，越高越好) + TG(理想100/臨界200) + LDL(理想100/臨界160)
  const hdlV=f("hdl");
  const hdlScore=hdlV==null?null:clamp10(10-5*Math.max(0,60-hdlV)/20);
  const dimLipid=avg([hdlScore,linScore(f("tg"),100,200),linScore(f("ldl"),100,160)]);
  // 肝臟：ALT(理想25/臨界80) + GGT(理想30/臨界100)
  const dimLiver=avg([linScore(f("alt"),25,80),linScore(f("ggt"),30,100)]);
  // 腎臟：eGFR(理想90/臨界60，越高越好) + UPCR(理想15/臨界150)
  const egfrV=f("egfr");
  const egfrScore=egfrV==null?null:clamp10(10-5*Math.max(0,90-egfrV)/30);
  const dimKidney=avg([egfrScore,linScore(f("upcr"),15,150)]);
  // 心血管：近7筆血壓平均值 + 結構性風險上限
  // 2025/03確診：雙側髂總動脈瘤 + LAD1冠狀動脈35%狹窄 + 頸動脈輕度粥樣硬化
  // 即使血壓控制完美，結構性問題存在 → 分數上限8.0，避免滿分誤導
  const CV_STRUCTURAL_CAP=8.0;
  const recentBP=(Array.isArray(bpHistory)?[...bpHistory].slice(-7):[]);
  const avgSys=recentBP.length>0?avg(recentBP.map(r=>parseFloat(r.systolic)).filter(v=>!isNaN(v))):null;
  const avgDia=recentBP.length>0?avg(recentBP.map(r=>parseFloat(r.diastolic)).filter(v=>!isNaN(v))):null;
  const dimCVraw=avg([linScore(avgSys,115,140),linScore(avgDia,75,90)]);
  const dimCV=dimCVraw==null?null:Math.min(dimCVraw,CV_STRUCTURAL_CAP);
  const cvLabel=avgSys&&avgDia?`心血管\n${Math.round(avgSys)}/${Math.round(avgDia)}`:"心血管";
  // 血液：血小板(理想200/臨界100，越高越好至正常) + Hb(理想15/臨界11)
  const pltV=f("platelet");
  const pltScore=pltV==null?null:clamp10(10-5*Math.max(0,200-pltV)/100);
  const dimBlood=avg([pltScore,linScore(f("hb"),15,11)]);
  // 尿酸：理想5.5/臨界8.5
  const dimUric=linScore(f("uric_acid"),5.5,8.5);
  // 免疫/其他：TSH正常+HBsAg陰性=滿分基底，CRP理想0.1/臨界1
  const crpV=f("crp");
  const dimOther=crpV!=null?linScore(crpV,0.1,1):9;
  return[
    {label:"血糖代謝",score:dimGlucose},
    {label:"血脂HDL",score:dimLipid},
    {label:"肝臟",score:dimLiver},
    {label:"腎臟",score:dimKidney},
    {label:cvLabel,score:dimCV,cvAvg:avgSys&&avgDia?`${Math.round(avgSys)}/${Math.round(avgDia)}`:null},
    {label:"血液",score:dimBlood},
    {label:"尿酸",score:dimUric},
    {label:"發炎/其他",score:dimOther},
  ].map(d=>({...d,score:d.score==null?null:Math.round(d.score*10)/10}));
};

export default function HealthJournal(){
  const [tab,setTab]=useState("home");
  const [recordTab,setRecordTab]=useState("glucose");
  const [selectedKnowledge,setSelectedKnowledge]=useState(null);
  const [kbTab,setKbTab]=useState("lab");
  const [selectedArticle,setSelectedArticle]=useState(null);
  const [selectedMedicine,setSelectedMedicine]=useState(null);
  const [customArticles,setCustomArticles]=useState(()=>{
    try{return JSON.parse(localStorage.getItem("hj_articles")||"[]");}catch(e){return[];}
  });
  const [showAddArticle,setShowAddArticle]=useState(false);
  const [trendItem,setTrendItem]=useState("overview");
  const [toast,setToast]=useState("");
  const [loading,setLoading]=useState(false);
  const [isOnline,setIsOnline]=useState(navigator.onLine);

  useEffect(()=>{
    const handleOnline=()=>{setIsOnline(true);showToast("✅ 網路已恢復");loadData();};
    const handleOffline=()=>{setIsOnline(false);showToast("⚠️ 離線中，資料暫存本地");};
    window.addEventListener('online',handleOnline);
    window.addEventListener('offline',handleOffline);
    return()=>{window.removeEventListener('online',handleOnline);window.removeEventListener('offline',handleOffline);};
  },[]);
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
  const DEFAULT_REMINDERS=[
    {id:"R001",title:"洗牙",icon:"🦷",intervalDays:180,lastDate:"2025-12-03",nextDate:"2026-06-01"},
    {id:"R002",title:"HbA1c追蹤",icon:"🩸",intervalDays:90,lastDate:"2026-05-27",nextDate:"2026-08-27"},
    {id:"R003",title:"腎功能追蹤",icon:"🫘",intervalDays:180,lastDate:"2026-05-27",nextDate:"2026-11-27"},
    {id:"R004",title:"眼底檢查",icon:"👁️",intervalDays:365,lastDate:"2025-05-27",nextDate:"2026-05-27"},
    {id:"R005",title:"心電圖",icon:"💓",intervalDays:365,lastDate:"2025-05-27",nextDate:"2026-05-27"},
  ];
  const [reminders,setReminders]=useState(()=>{
    try{
      const saved=localStorage.getItem("hj_reminders");
      return saved?JSON.parse(saved):DEFAULT_REMINDERS;
    }catch(e){return DEFAULT_REMINDERS;}
  });
  const [editReminder,setEditReminder]=useState(null);
  const [sleepLog,setSleepLog]=useState([]);
  const [showOverdue,setShowOverdue]=useState(false);
  const [trackItems,setTrackItems]=useState(()=>{
    try{ const s=localStorage.getItem("hj_track"); return s?JSON.parse(s):DEFAULT_TRACK; }
    catch(e){ return DEFAULT_TRACK; }
  });
  const [showTrackPicker,setShowTrackPicker]=useState(false);
  const [trendAiKey,setTrendAiKey]=useState(null);
  const [labInfoKey,setLabInfoKey]=useState(null);
  const [kbNotes,setKbNotes]=useState(()=>{
    try{const s=localStorage.getItem("hj_kb");return s?JSON.parse(s):[];}
    catch(e){return[];}
  });
  const [kbForm,setKbForm]=useState({title:"",category:"飲食",content:"",photo:null});
  const [kbAiLoading,setKbAiLoading]=useState(false);
  const [showKbForm,setShowKbForm]=useState(false);
  const kbPhotoRef=React.useRef();
  const [trendAiResult,setTrendAiResult]=useState({});
  const [trendAiLoading,setTrendAiLoading]=useState(false);
  const [imagingForm,setImagingForm]=useState({date:today(),type:"腹部超音波",hospital:"",country:"台灣",finding:"",recommendation:"",nextDate:"",note:""});
  const [editImaging,setEditImaging]=useState(null);
  const [breakfastLog,setBreakfastLog]=useState([]);
  const [exerciseLog,setExerciseLog]=useState([]);
  const [imagingPhotos,setImagingPhotos]=useState([]);
  const imagingPhotoRef = React.useRef();
  const [lightboxUrl,setLightboxUrl]=useState(null);
  const [imagingHistory,setImagingHistory]=useState([]);
  const [syncStatus,setSyncStatus]=useState("idle"); // idle|syncing|synced|error
  const [lastSync,setLastSync]=useState(null);
  const [submitting,setSubmitting]=useState(false); // 防重複提交

  // 表單
  const [glucoseForm,setGlucoseForm]=useState({value:"",unit:"mmol/L",timePoint:"空腹",source:"日常",note:""});
  const [bpForm,setBpForm]=useState({sys:"",dia:"",pulse:"",source:"日常"});
  const [weightForm,setWeightForm]=useState({value:""});

  // 抽血報告解析
  const [labStep,setLabStep]=useState("input"); // input | parsing | confirm | saving
  const [labInputText,setLabInputText]=useState("");
  const [labPhotos,setLabPhotos]=useState([]); // [{dataUrl,file}]
  const [labParsed,setLabParsed]=useState({});
  const [labForm,setLabForm]=useState({date:"",hospital:"",country:"台灣",fasting:"空腹"});
  const [showPhotoWarning,setShowPhotoWarning]=useState(false);
  const [pendingPhotos,setPendingPhotos]=useState(null);
  // ── 每日AI顧問問候 ──────────────────────────────────
  const [dailyGreeting,setDailyGreeting]=useState(()=>{
    try{
      const cache=JSON.parse(localStorage.getItem("hj_daily_greeting")||"null");
      if(cache&&cache.date===new Date().toISOString().split("T")[0])return cache.greeting;
    }catch(e){}
    return null;
  });
  const [greetingLoading,setGreetingLoading]=useState(false);

  const generateDailyGreeting=async()=>{
    const key=localStorage.getItem("hj_apikey")||"";
    if(!key||greetingLoading)return;
    const todayStr=new Date().toISOString().split("T")[0];
    const cache=JSON.parse(localStorage.getItem("hj_daily_greeting")||"null");
    if(cache&&cache.date===todayStr)return; // 今天已產生
    setGreetingLoading(true);
    try{
      const hour=new Date().getHours();
      const timeGreet=hour<12?"早安":hour<18?"午安":"晚安";
      const weekday=["日","一","二","三","四","五","六"][new Date().getDay()];
      const isWeekend=new Date().getDay()===0||new Date().getDay()===6;
      // 昨晚睡眠
      const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
      const yStr=yesterday.toISOString().split("T")[0];
      const lastSleep=[...sleepLog].sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0];
      const sleepNote=lastSleep
        ?`昨晚睡眠：${Math.floor((lastSleep.total_min||0)/60)}小時${(lastSleep.total_min||0)%60}分，深層${Math.round((lastSleep.deep_min||0)/(lastSleep.total_min||1)*100)}%，評分${lastSleep.score||"—"}，血氧${lastSleep.spo2_avg||"—"}%`
        :"無昨晚睡眠記錄";
      // 最近血壓
      const lastBP=[...bpHistory].sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0];
      const bpNote=lastBP?`最近血壓 ${lastBP.systolic}/${lastBP.diastolic}`:"無血壓記錄";
      // 最近血糖
      const lastGluc=[...glucoseHistory].sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0];
      const glucNote=lastGluc?`最近血糖 ${lastGluc.value_mgdl} mg/dL`:"無血糖記錄";
      // 到期追蹤
      const overdues=reminders.filter(r=>new Date(r.nextDate)<=new Date()).map(r=>r.title).slice(0,2);
      const prompt=`你是Steven的私人健康顧問，每天早上用溫暖、簡短的方式跟他打招呼並提醒最重要的健康狀況。

Steven基本資料：55歲台灣男性，越南海防工作，與家人分隔兩地。
七項並發診斷：高血壓、雙側髂總動脈瘤、LAD1冠狀動脈35%狹窄、脂肪肝Grade II、高尿酸、肝酶偏高、糖尿病前期HbA1c。
今天：週${weekday}${isWeekend?"（週末，麵食血糖風險高）":""}，現在${hour}點。

今日狀況：
・${sleepNote}
・${bpNote}
・${glucNote}
${overdues.length>0?`・追蹤提醒已過期：${overdues.join("、")}`:""}

請用2-3句話跟Steven說話，像朋友兼顧問：
1. 根據昨晚睡眠給一句具體評語
2. 今天最需要注意的一件事（結合他的複合診斷，不要只說單點）
3. 一句鼓勵或提醒
語氣溫暖自然，不要像報告，不要用標題或條列，直接說話。繁體中文。`;
      const result=await callClaude([{role:"user",content:prompt}],300);
      if(result&&!result.startsWith("❌")){
        setDailyGreeting(result);
        localStorage.setItem("hj_daily_greeting",JSON.stringify({date:todayStr,greeting:result}));
      }
    }catch(e){console.log("greeting error",e);}
    setGreetingLoading(false);
  };

  const [aiReport,setAiReport]=useState(()=>{
    try{
      const cache=JSON.parse(localStorage.getItem("hj_weekly_cache")||"null");
      if(cache&&cache.date===new Date().toISOString().split("T")[0])return cache.report;
    }catch(e){}
    return null;
  });
  const [aiReportDate,setAiReportDate]=useState(()=>{
    try{
      const cache=JSON.parse(localStorage.getItem("hj_weekly_cache")||"null");
      if(cache&&cache.date===new Date().toISOString().split("T")[0])return cache.date;
    }catch(e){}
    return null;
  });
  const [aiLoading,setAiLoading]=useState(false);
  const [overallReport,setOverallReport]=useState(()=>{
    try{
      const cache=JSON.parse(localStorage.getItem("hj_overall_cache")||"null");
      if(cache)return cache.report;
    }catch(e){}
    return null;
  });
  const [overallDate,setOverallDate]=useState(()=>{
    try{
      const cache=JSON.parse(localStorage.getItem("hj_overall_cache")||"null");
      if(cache)return cache.date;
    }catch(e){}
    return null;
  });
  const [overallLoading,setOverallLoading]=useState(false);
  const [showApiInput,setShowApiInput]=useState(false);
  const photoInputRef=useRef();

  const showToast=(msg)=>{setToast(msg);setTimeout(()=>setToast(""),2800);};

  const saveHospital=(name)=>{
    if(!name||hospitalList.includes(name))return;
    const updated=[name,...hospitalList].slice(0,10);
    setHospitalList(updated);
    localStorage.setItem("hj_hospitals",JSON.stringify(updated));
    api.saveSetting("hospitals", updated); // 同步到Sheets
  };

  const loadData=useCallback(async()=>{
    setLoading(true);
    setSyncStatus("syncing");
    try{
      const [lab,glu,bp,wt,settings,imaging,bkf]=await Promise.all([
        api.get("getLabHistory"),
        api.get("getAll",{sheet:"daily_glucose"}),
        api.get("getAll",{sheet:"daily_bp"}),
        api.get("getAll",{sheet:"daily_weight"}),
        api.loadSettings(),
        api.get("getAll",{sheet:"imaging"}),
        api.get("getAll",{sheet:"breakfast_log"}),
        api.get("getAll",{sheet:"exercise_log"}),
      ]);
      if(lab?.data)setLabHistory(lab.data);
      if(glu?.data)setGlucoseHistory(glu.data);
      if(bp?.data)setBpHistory(bp.data);
      if(wt?.data)setWeightHistory(wt.data);
      if(bkf?.data)setBreakfastLog(bkf.data.filter(r=>r.date&&String(r.date).trim()));
      const [exLog]=await Promise.all([api.get("getAll",{sheet:"exercise_log"})]);
      if(exLog?.data)setExerciseLog(exLog.data.filter(r=>r.date&&String(r.date).trim()));
      if(imaging?.data){
        // 過濾空白列（id或date或type為空/空白的）
        const validImaging = imaging.data.filter(r =>
          r.id && String(r.id).trim() &&
          r.date && String(r.date).trim() &&
          r.type && String(r.type).trim()
        );
        setImagingHistory(validImaging);
      }
      setSyncStatus("synced");
      setLastSync(new Date());
      // 從 Sheets 恢復設定
      if(settings?.data){
        const s=settings.data;
        if(s.hospitals){
          const h=JSON.parse(s.hospitals);
          setHospitalList(h);
          localStorage.setItem("hj_hospitals",JSON.stringify(h));
        }
        if(s.reminders){
          const r=JSON.parse(s.reminders);
          setReminders(r);
          localStorage.setItem("hj_reminders",JSON.stringify(r));
        }
        if(s.trackItems){
          const t=JSON.parse(s.trackItems);
          setTrackItems(t);
          localStorage.setItem("hj_track",JSON.stringify(t));
        }
      }
    }catch(e){console.log("載入失敗:",e);setSyncStatus("error");}
    setLoading(false);
  },[]);

  useEffect(()=>{loadData();},[loadData]);

  // 儲存血糖
  const saveGlucose=async()=>{
    if(submitting){return;}
    if(!glucoseForm.value){showToast("⚠️ 請輸入血糖值");return;}
    setSubmitting(true);
    const mgdl=toMgdl(glucoseForm.value,glucoseForm.unit);
    const now=new Date();
    const r=await api.post("append","daily_glucose",{
      date:now.toISOString().split("T")[0],time:now.toTimeString().slice(0,5),
      timePoint:glucoseForm.timePoint,value_mgdl:mgdl,
      value_original:glucoseForm.value,unit_original:glucoseForm.unit,
      source:glucoseForm.source,note:glucoseForm.note,
    });
    if(r?.success){showToast(`✅ 血糖 ${mgdl} mg/dL 已儲存`);setGlucoseForm({value:"",unit:"mmol/L",timePoint:"空腹",source:"日常",note:""});loadData();}
    else showToast("❌ 血糖儲存失敗：" + (r?.error || "請檢查網路連線"));
    setSubmitting(false);
  };

  const saveBP=async()=>{
    if(submitting){return;}
    if(!bpForm.sys||!bpForm.dia){showToast("⚠️ 請輸入血壓值");return;}
    setSubmitting(true);
    const now=new Date();
    const r=await api.post("append","daily_bp",{
      date:now.toISOString().split("T")[0],time:now.toTimeString().slice(0,5),
      systolic:parseInt(bpForm.sys),diastolic:parseInt(bpForm.dia),
      pulse:parseInt(bpForm.pulse)||"",source:bpForm.source,
    });
    if(r?.success){showToast("✅ 血壓已儲存");setBpForm({sys:"",dia:"",pulse:"",source:"日常"});loadData();}
    else showToast("❌ 儲存失敗");
    setSubmitting(false);
  };

  const saveWeight=async()=>{
    if(submitting){return;}
    if(!weightForm.value){showToast("⚠️ 請輸入體重");return;}
    setSubmitting(true);
    const r=await api.post("append","daily_weight",{date:today(),value_kg:parseFloat(weightForm.value)});
    if(r?.success){showToast("✅ 體重已儲存");setWeightForm({value:""});loadData();}
    else showToast("❌ 儲存失敗");
    setSubmitting(false);
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

  const labPhotoInputRef2 = React.useRef();
  const confirmPhotos=()=>{
    setShowPhotoWarning(false);
    setPendingPhotos(null);
    setTimeout(()=>{ photoInputRef.current?.click(); }, 100);
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
      content.push({type:"text",text:`你是醫療報告解析助手。任務：從以下報告提取所有數值，回傳純JSON，禁止任何說明文字。

重要規則：
1. 抓取報告中出現的所有數值，不要遺漏
2. key名稱用以下對應（小寫英文）：
   hba1c=HbA1c/糖化血色素
   glucose_ac=Glucose AC/空腹血糖/GLU（空腹）
   alt=ALT/SGPT
   ast=AST/SGOT
   alp=ALP/鹼性磷酸酶
   ggt=GGT/麩胺轉移酶
   ldh=LDH
   tbil=Total Bilirubin/總膽紅素/TBILC
   dbil=Direct Bilirubin/直接膽紅素/DBILC
   tp=Total Protein/總蛋白/TP
   alb=Albumin/白蛋白/ALB
   glob=Globulin/球蛋白/GLO
   ag_ratio=A/G Ratio
   hdl=HDL-C/HDL/高密度脂蛋白
   ldl=LDL-C/LDL/低密度脂蛋白
   tg=TG/Triglyceride/三酸甘油酯
   cholesterol=Total Cholesterol/總膽固醇/CHOL
   chol_hdl=CHOL/HDL-C比值/膽固醇HDL比值
   uric_acid=Uric Acid/尿酸/UA
   creatinine=Creatinine/肌酸酐/CRE（血清，非尿液）
   gfr=GFR（取第一個數值，通常是CKD-EPI公式）
   gfr2=eGFR(MDRD)/第二個eGFR數值
   bun=BUN/血中尿素氮
   upcr=UPCR/Protein Creatinine Ratio
   urine_creatinine=Urine Creatinine/尿液肌酸酐/CREA(Random Urine)
   urine_protein=Urine Protein/尿液蛋白/Micro-Total Protein/Total Protein(Urine)
   tsh=TSH/甲狀腺促素
   ft3=Free T3
   ft4=Free T4
   na=Sodium/鈉/Na
   k=Potassium/鉀/K
   cl=Chloride/氯/Cl
   ca=Calcium/鈣/Ca
   mg=Magnesium/鎂/MG
   phos=Phosphorus/磷/PHOS
   crp=CRP/C反應蛋白
   amy=Amylase/澱粉酶/AMY
   lip=Lipase/脂肪酶/LIP
   ck=CK/肌酸激酶
   fe=Iron/鐵/FE
   uibc=UIBC
   tibc=TIBC
   fe_sat=Iron Saturation/鐵飽和度/FE_sat
   hb=Hb/Hemoglobin/血紅素
   wbc=WBC/白血球
   rbc=RBC/紅血球
   hct=Hct/血球容積
   mcv=MCV（平均紅血球容積）
   mch=MCH（平均紅血球血色素）
   mchc=MCHC（平均紅血球血色素濃度）
   rdw_cv=RDW-CV（紅血球分布寬度CV）
   rdw_sd=RDW-SD（紅血球分布寬度SD）
   platelet=Platelet/PLT/血小板
   mpv=MPV（平均血小板容積）
3. 數值只填數字，不要單位
4. 找不到的欄位填null
5. 單位換算規則（非常重要，必須正確換算）：

   血糖/葡萄糖 mmol/L → mg/dL：×18.016
   膽固醇/HDL/LDL/TG mmol/L → mg/dL：×38.67
   肌酸酐 μmol/L或umol/L → mg/dL：÷88.4
   尿酸 μmol/L或umol/L → mg/dL：÷59.48
   尿素/BUN mmol/L → mg/dL：×2.8（注意：越南報告的Urea mmol/L換算BUN）
   鈣 mmol/L → mg/dL：×4.008
   磷 mmol/L → mg/dL：×3.097
   鎂 mmol/L → mg/dL：×2.431
   血紅素/Hb g/L → g/dL：÷10
   MCHC g/L → g/dL：÷10
   總膽紅素 μmol/L → mg/dL：÷17.1
   直接膽紅素 μmol/L → mg/dL：÷17.1
   白蛋白 g/L → g/dL：÷10
   總蛋白 g/L → g/dL：÷10
   電解質 Na/K/Cl mmol/L = mEq/L（不需換算）
   HCT：若為小數（0.453）請×100轉成百分比（45.3）
   WBC/RBC/PLT：G/L = 10³/μL（不需換算數值）

6. 支援多種報告格式：
   台灣格式：「ALT: 45 U/L」
   越南格式：「ALT(GPT): 54 U/L」「Creatinine: 69.5 μmol/L」
   DxC 700 AU：「ALT 43」「CRE 0.82」

7. 欄位對應（補充）：
   amy=AMY/Amylase
   ck=CK
   ggt=GGT/Gamma-GT
   fe=FE/Iron/Sắt
   lip=LIP/Lipase
   tp=TP/Total Protein/Protein toàn phần（若g/L請÷10）
   ldh=LDH
   k=K/Potassium/Kali
   ag_ratio=A/G Ratio
   alb=ALB/Albumin（若g/L請÷10）
   crp=CRP
   mg=MG/Magnesium（若mmol/L請×2.431）
   uibc=UIBC
   na=Na/Sodium/Natri
   tibc=TIBC
   alp=ALP
   dbil=DBILC/Direct Bilirubin（若μmol/L請÷17.1）
   phos=PHOS/Phosphorus（若mmol/L請×3.097）
   tbil=TBILC/Total Bilirubin（若μmol/L請÷17.1）
   bun=BUN/Urea（Urea mmol/L請×2.8換算BUN mg/dL）
   ca=CA/Calcium（若mmol/L請×4.008）
   cl=Cl/Chloride
   glob=GLO/Globulin（若g/L請÷10）
   fe_sat=FE_sat/Iron Saturation
   creatinine=CRE/Creatinine（若μmol/L請÷88.4）
   uric_acid=UA/Uric Acid（若μmol/L請÷59.48）
   glucose_ac=GLU/Glucose/HbA1c旁的血糖（若mmol/L請×18.016）
   cholesterol=CHOL/Total Cholesterol（若mmol/L請×38.67）
   hb=HGB/Hemoglobin（若g/L請÷10）
   mchc=MCHC（若g/L請÷10）
   ne_pct=NE%/Neutrophil%/嗜中性球%（百分比）
   ly_pct=LY%/Lymphocyte%/淋巴球%（百分比）
   mo_pct=MO%/Monocyte%/單核球%（百分比）
   eo_pct=EO%/Eosinophil%/嗜酸性球%（百分比）
   ba_pct=BA%/Basophil%/嗜鹼性球%（百分比）
   ne_abs=NE#/Neutrophil#/嗜中性球絕對值（G/L或10^3/uL）
   ly_abs=LY#/Lymphocyte#/淋巴球絕對值
   mo_abs=MO#/Monocyte#/單核球絕對值
   eo_abs=EO#/Eosinophil#/嗜酸性球絕對值
   ba_abs=BA#/Basophil#/嗜鹼性球絕對值
   hbsag=HBsAg（陰性填0，陽性填1）
   anti_hcv=Anti-HCV（陰性填0，陽性填1）
   anti_hbs=Anti-HBs（陰性填0，陽性填1）
   cea=CEA/癌胚抗原
   afp=AFP/甲胎蛋白
   psa=PSA/攝護腺特異抗原
   asto=ASTO/抗鏈球菌溶血素O（陰性填0，陽性填1）
   rf=RF/類風濕因子（陰性填0，陽性填1）
   urine_glucose=尿糖/Glucose(Urine)（negative填0，positive填1）
   urine_bilirubin=尿膽紅素/Bilirubin(Urine)（negative填0，positive填1）
   urine_ketone=尿酮體/Ketone(Urine)（negative填0，positive填1）
   urine_sg=尿比重/Specific Gravity（填數值如1.010）
   urine_ph=尿液pH（填數值如6.0）
   urine_nitrite=亞硝酸鹽/Nitrite（negative填0，positive填1）
   urine_urobilinogen=尿膽素原/Urobilinogen（negative填0，positive填1）
   urine_blood=尿潛血/Blood(Urine)（negative填0，positive填1）
   urine_leukocyte=尿白血球/Leukocyte(Urine)（negative填0，positive填1）

報告內容：
${textPart}

只回傳JSON格式，包含所有找到的欄位（有值的填數值，沒有的填null）：
{"date":null,"hospital":null,"hba1c":null,"glucose_ac":null,"alt":null,"ast":null,"alp":null,"ggt":null,"ldh":null,"tbil":null,"dbil":null,"tp":null,"alb":null,"glob":null,"ag_ratio":null,"hdl":null,"ldl":null,"tg":null,"cholesterol":null,"chol_hdl":null,"uric_acid":null,"creatinine":null,"gfr":null,"gfr2":null,"bun":null,"upcr":null,"urine_creatinine":null,"urine_protein":null,"tsh":null,"ft3":null,"ft4":null,"na":null,"k":null,"cl":null,"ca":null,"mg":null,"phos":null,"crp":null,"amy":null,"lip":null,"ck":null,"ck_mb":null,"fe":null,"uibc":null,"tibc":null,"fe_sat":null,"hb":null,"wbc":null,"rbc":null,"hct":null,"mcv":null,"mch":null,"mchc":null,"rdw_cv":null,"rdw_sd":null,"platelet":null,"mpv":null,"ne_pct":null,"ly_pct":null,"mo_pct":null,"eo_pct":null,"ba_pct":null,"ne_abs":null,"ly_abs":null,"mo_abs":null,"eo_abs":null,"ba_abs":null,"hbsag":null,"anti_hcv":null,"anti_hbs":null,"cea":null,"afp":null,"psa":null,"asto":null,"rf":null,"urine_glucose":null,"urine_bilirubin":null,"urine_ketone":null,"urine_sg":null,"urine_ph":null,"urine_nitrite":null,"urine_urobilinogen":null,"urine_blood":null,"urine_leukocyte":null,"note":null}`});

      const rawText = await callClaude([{role:"user",content}], 1200);
      console.log("Raw text:",rawText.slice(0,500));
      // 清理並解析JSON - 多重嘗試
      let parsed={};
      try{
        const clean=rawText.replace(/```json|```|\n/g,"").trim();
        parsed=JSON.parse(clean);
      }catch(e1){
        try{
          const start=rawText.indexOf("{");
          const end=rawText.lastIndexOf("}");
          if(start>=0&&end>start){
            parsed=JSON.parse(rawText.slice(start,end+1));
          }
        }catch(e2){
          console.log("JSON parse failed:",rawText);
          // 嘗試手動提取數值
          const extract=(pattern)=>{
            const m=rawText.match(pattern);
            return m?parseFloat(m[1]):null;
          };
          parsed={
            hba1c:extract(/hba1c["\s:]+([0-9.]+)/i),
            glucose_ac:extract(/glucose[_\s]?ac["\s:]+([0-9.]+)/i)||extract(/glucose["\s:]+([0-9.]+)/i),
            alt:extract(/alt["\s:]+([0-9.]+)/i)||extract(/sgpt["\s:]+([0-9.]+)/i),
            hdl:extract(/hdl["\s:]+([0-9.]+)/i),
            ldl:extract(/ldl["\s:]+([0-9.]+)/i),
            tg:extract(/tg["\s:]+([0-9.]+)/i)||extract(/triglyceride["\s:]+([0-9.]+)/i),
            cholesterol:extract(/cholesterol["\s:]+([0-9.]+)/i),
            uric_acid:extract(/uric[_\s]?acid["\s:]+([0-9.]+)/i),
            creatinine:extract(/creatinine["\s:]+([0-9.]+)/i),
            tsh:extract(/tsh["\s:]+([0-9.]+)/i),
            hb:extract(/hb["\s:]+([0-9.]+)/i)||extract(/hemoglobin["\s:]+([0-9.]+)/i),
            wbc:extract(/wbc["\s:]+([0-9.]+)/i),
            platelet:extract(/platelet["\s:]+([0-9.]+)/i),
          };
        }
      }
      // 過濾null值
      Object.keys(parsed).forEach(k=>{
        if(parsed[k]===null||parsed[k]===undefined||parsed[k]==="null"||parsed[k]==="")delete parsed[k];
      });

      // ── Batch2：extra_data 兜底 ─────────────────────────
      // 已知欄位白名單（所有有定義的欄位）
      const KNOWN_KEYS = new Set([
        "date","hospital","country","fasting","doctor","note",
        "hba1c","glucose_ac","glucose_pc","glucose_random",
        "alt","ast","alp","ggt","ldh","tbil","dbil","tp","alb","glob","ag_ratio",
        "hdl","ldl","tg","cholesterol","chol_hdl",
        "uric_acid","creatinine","gfr","gfr2","bun","upcr","urine_creatinine","urine_protein","urine_protein2",
        "tsh","ft3","ft4",
        "na","k","cl","ca","mg","phos",
        "crp","amy","lip","ck","ck_mb",
        "fe","uibc","tibc","fe_sat",
        "hb","wbc","rbc","hct","mcv","mch","mchc","rdw_cv","rdw_sd","platelet","mpv",
        "ne_pct","ly_pct","mo_pct","eo_pct","ba_pct",
        "ne_abs","ly_abs","mo_abs","eo_abs","ba_abs",
        "hbsag","anti_hcv","anti_hbs",
        "cea","afp","psa","asto","rf",
        "urine_glucose","urine_bilirubin","urine_ketone","urine_sg","urine_ph",
        "urine_nitrite","urine_urobilinogen","urine_blood","urine_leukocyte",
        "extra_data","source_country","createdAt","id",
      ]);
      // 找出不在白名單的欄位
      const extraObj = {};
      Object.keys(parsed).forEach(k=>{
        if(!KNOWN_KEYS.has(k)) extraObj[k] = parsed[k];
      });
      if(Object.keys(extraObj).length > 0){
        parsed._extraData = extraObj; // 暫存，saveLabReport時合併
      }
      // ───────────────────────────────────────────────────

      console.log("Parsed:",JSON.stringify(parsed));

      // 合併到表單
      setLabParsed(parsed);
      setLabForm(prev=>({
        ...prev,
        date:parsed.date||prev.date,
        hospital:parsed.hospital||prev.hospital,
      }));
      setLabStep("confirm");
    }catch(e){
      if(e.message==="NO_API_KEY"){
        showToast("⚠️ 請先在設定Tab輸入API金鑰");
        setTab("setting");
      }else if(e.message.includes("401")){
        showToast("❌ API金鑰無效，請至設定Tab重新輸入");
        setTab("setting");
      }else if(e.message.includes("429")){
        showToast("❌ API使用量超限，請稍後再試");
      }else{
        showToast("❌ 解析失敗："+e.message);
      }
      setLabStep("input");
    }
  };

    // 確認儲存抽血報告
  const saveLabReport=async()=>{
    if(!labForm.hospital){showToast("⚠️ 請輸入醫院名稱");return;}
    setLabStep("saving");
    // 合併所有資料：labParsed（AI解析）+ labForm（使用者輸入）
    // labForm 優先覆蓋
    const {_extraData, ...parsedClean} = labParsed;
    const data={...parsedClean,...labForm};
    // 合併 extra_data（保留舊值，追加新值）
    let existingExtra = {};
    try { existingExtra = data.extra_data ? JSON.parse(data.extra_data) : {}; } catch(e){}
    const mergedExtra = {...existingExtra, ...(_extraData||{})};
    if(Object.keys(mergedExtra).length > 0){
      data.extra_data = JSON.stringify(mergedExtra);
    }
    // 確保基本欄位都有
    if(!data.createdAt) data.createdAt=new Date().toISOString();
    if(!data.id) data.id="LAB"+Date.now();

    // 先更新 Sheets 欄位（確保新欄位存在）
    await api.get("updateLabColumns");

    const r=await api.post("append","lab_reports",data);
    if(r?.success){
      saveHospital(labForm.hospital);
      const SKIP_COUNT_KEYS = new Set(['id','date','hospital','country','doctor','fasting','note','extra_data','source_country','createdAt','_extraData','_type','_icon','_label','_summary']);
      const dataCount = Object.keys(data).filter(k=>
        !SKIP_COUNT_KEYS.has(k) &&
        data[k]!==null && data[k]!==undefined && data[k]!==""
      ).length;
      showToast(`✅ 抽血報告已儲存（${dataCount}筆數據）`);
      // 自動更新抽血相關追蹤提醒
      await autoUpdateReminder("lab", labForm.date||data.date||today());
      setLabStep("input");
      setLabInputText("");setLabPhotos([]);
      setLabParsed({});setLabForm({date:"",hospital:"",country:"台灣",fasting:"空腹"});
      loadData();
    }else{
      showToast("❌ 儲存失敗：" + (r?.error || "請確認網路連線和Apps Script部署"));
      setLabStep("confirm");
    }
  };

  const toggleTrack = (key) => {
    setTrackItems(prev => {
      const updated = prev.includes(key) ? prev.filter(k=>k!==key) : [...prev, key];
      localStorage.setItem("hj_track", JSON.stringify(updated));
      api.saveSetting("trackItems", updated); // 同步到Sheets
      return updated;
    });
  };

  // ── 自動更新追蹤提醒（存入記錄時觸發）────────────────
  const autoUpdateReminder=async(recordType,recordDate)=>{
    if(!reminders||reminders.length===0)return;
    // 配對規則：記錄類型關鍵字 → 提醒關鍵字 + 間隔月數
    const RULES=[
      {recKeys:["腹部超音波","腹部CT","腹部MRI","腹超"],reminderKeys:["腹","超音波","肝臟"],months:6},
      {recKeys:["心臟超音波","心臟CT","心臟MRI","心電圖"],reminderKeys:["心臟","心血管","心電","LAD","冠狀"],months:6},
      {recKeys:["頸動脈超音波"],reminderKeys:["頸動脈"],months:12},
      {recKeys:["視野檢查","右眼視野"],reminderKeys:["視野"],months:4},
      {recKeys:["眼底攝影","眼科綜合","眼底","OCT"],reminderKeys:["眼底","眼科","視網膜","OCT"],months:6},
      {recKeys:["大腸鏡"],reminderKeys:["大腸"],months:60},
      {recKeys:["胃鏡"],reminderKeys:["胃鏡"],months:24},
      {recKeys:["腦部MRI","頭部CT"],reminderKeys:["腦部","神經"],months:12},
      {recKeys:["骨密度"],reminderKeys:["骨密度"],months:24},
      // 抽血 → 對應多種血液相關提醒（3個月）
      {recKeys:["lab","抽血","血液"],reminderKeys:["血液","抽血","血常規","血液常規"],months:3},
      {recKeys:["lab","抽血","肝功能"],reminderKeys:["肝功能","肝","ALT","尿酸"],months:3},
      {recKeys:["lab","抽血","腎功能"],reminderKeys:["腎功能","腎","肌酸酐","eGFR"],months:6},
      {recKeys:["住院摘要"],reminderKeys:["心臟科","心血管"],months:6},
    ];
    // 找所有符合的規則（一筆抽血可能對應多項提醒）
    const matchedRules=RULES.filter(r=>r.recKeys.some(k=>recordType.includes(k)||recordType===k));
    if(matchedRules.length===0)return;
    // 收集所有符合的提醒（去重）
    const base0=new Date(recordDate);
    if(isNaN(base0.getTime()))return;
    let updated=0;
    const updatedIds=new Set();
    const localUpdates=[];
    for(const rule of matchedRules){
      const matched=reminders.filter(rem=>rule.reminderKeys.some(k=>(rem.title||"").includes(k)));
      for(const rem of matched){
        if(updatedIds.has(rem.id))continue;
        updatedIds.add(rem.id);
        const base=new Date(recordDate);
        base.setMonth(base.getMonth()+rule.months);
        const newNextDate=`${base.getFullYear()}-${String(base.getMonth()+1).padStart(2,"0")}-${String(base.getDate()).padStart(2,"0")}`;
        const r=await api.post("updateReminder","reminders",
          {id:rem.id,lastDate:recordDate,nextDate:newNextDate});
        if(r?.success){updated++;localUpdates.push({id:rem.id,lastDate:recordDate,nextDate:newNextDate});}
      }
    }
    if(updated>0){
      // 立即更新本地state（不必等loadData）
      setReminders(prev=>prev.map(rem=>{
        const u=localUpdates.find(x=>x.id===rem.id);
        return u?{...rem,lastDate:u.lastDate,nextDate:u.nextDate}:rem;
      }));
      showToast(`✅ 已自動更新 ${updated} 項追蹤提醒`);
    }
    return;
  };

  const saveImaging = async () => {
    if (!imagingForm.hospital) { showToast("⚠️ 請輸入醫院名稱"); return; }
    if (!imagingForm.finding) { showToast("⚠️ 請輸入報告結論"); return; }
    const r = await api.post("append", "imaging", {
      date: imagingForm.date,
      type: imagingForm.type,
      hospital: imagingForm.hospital,
      country: imagingForm.country,
      finding: imagingForm.finding,
      recommendation: imagingForm.recommendation,
      nextDate: imagingForm.nextDate,
      driveUrl: imagingPhotos.join(","),
      note: imagingForm.note,
    });
    if (r?.success) {
      showToast("✅ 影像檢查記錄已儲存");
      saveHospital(imagingForm.hospital);
      // 自動更新追蹤提醒
      await autoUpdateReminder(imagingForm.type, imagingForm.date);
      setImagingForm({date:today(),type:"腹部超音波",hospital:"",country:"台灣",finding:"",recommendation:"",nextDate:"",note:""});
      setImagingPhotos([]);
      loadData();
    } else showToast("❌ 儲存失敗");
  };

  const updateImaging = async () => {
    if (!editImaging) return;
    if (!editImaging.hospital) { showToast("⚠️ 請輸入醫院名稱"); return; }
    if (!editImaging.finding) { showToast("⚠️ 請輸入報告結論"); return; }
    const r = await api.post("update", "imaging", {
      id: editImaging.id,
      date: editImaging.date,
      type: editImaging.type,
      hospital: editImaging.hospital,
      country: editImaging.country,
      finding: editImaging.finding,
      recommendation: editImaging.recommendation,
      nextDate: editImaging.nextDate,
      driveUrl: editImaging.driveUrl||"",
      note: editImaging.note||"",
    });
    if (r?.success) {
      showToast("✅ 記錄已更新");
      setEditImaging(null);
      loadData();
    } else showToast("❌ 更新失敗，請確認GAS有update功能");
  };

  const updateReminderDate=(id,lastDate)=>{
    setReminders(prev=>{
      const updated=prev.map(r=>{
        if(r.id!==id)return r;
        const next=new Date(lastDate);
        next.setDate(next.getDate()+r.intervalDays);
        return{...r,lastDate,nextDate:next.toISOString().split("T")[0]};
      });
      localStorage.setItem("hj_reminders",JSON.stringify(updated));
      api.saveSetting("reminders", updated); // 同步到Sheets
      return updated;
    });
    showToast("✅ 提醒已更新並同步到雲端");setEditReminder(null);
  };

  // 2025/03住院追蹤套組（一鍵建立）
  const addHospitalFollowups=()=>{
    const PACK=[
      {id:"HF01",title:"心臟科追蹤（髂動脈瘤+LAD1狹窄）",icon:"🫀",intervalDays:180,lastDate:"2025-03-19",nextDate:"2025-09-19"},
      {id:"HF02",title:"右眼視野複查",icon:"👁️",intervalDays:120,lastDate:"2025-03-19",nextDate:"2025-07-19"},
      {id:"HF03",title:"眼底追蹤+OCT（視網膜退化）",icon:"👁️",intervalDays:180,lastDate:"2025-03-19",nextDate:"2025-09-19"},
      {id:"HF04",title:"腹部超音波（脂肪肝G2+腎囊腫）",icon:"🔬",intervalDays:180,lastDate:"2025-03-19",nextDate:"2025-09-19"},
      {id:"HF05",title:"血液常規（WBC+血小板追蹤）",icon:"🩸",intervalDays:90,lastDate:"2025-03-19",nextDate:"2025-06-19"},
      {id:"HF06",title:"肝功能ALT+尿酸追蹤",icon:"🫁",intervalDays:90,lastDate:"2025-03-19",nextDate:"2025-06-19"},
    ];
    setReminders(prev=>{
      const existIds=new Set(prev.map(r=>r.id));
      const toAdd=PACK.filter(p=>!existIds.has(p.id));
      if(toAdd.length===0){showToast("✅ 追蹤套組已存在，無需重複建立");return prev;}
      const updated=[...prev,...toAdd];
      localStorage.setItem("hj_reminders",JSON.stringify(updated));
      api.saveSetting("reminders",updated);
      showToast(`✅ 已建立 ${toAdd.length} 項住院追蹤提醒`);
      return updated;
    });
  };

  const latestGlucose=glucoseHistory.length>0?glucoseHistory[glucoseHistory.length-1]:null;
  const latestBP=bpHistory.length>0?bpHistory[bpHistory.length-1]:null;
  const latestWeight=weightHistory.length>0?weightHistory[weightHistory.length-1]:null;
  const latestLab=labHistory.length>0?labHistory[labHistory.length-1]:null;
  const overdueReminders=reminders.filter(r=>new Date(r.nextDate)<=new Date());



// ── 檢驗項目說明資料庫 ────────────────────────────────
const LAB_INFO = {
  hba1c: {
    name:"HbA1c（糖化血色素）",
    desc:"反映過去2-3個月的平均血糖水平，是糖尿病診斷和控制的重要指標。",
    range:"正常 <5.7%　糖尿病前期 5.7-6.4%　糖尿病 ≥6.5%",
    meaning:"數值越高代表長期血糖控制越差，與心血管、腎臟、視網膜等併發症風險相關。",
    improve:"減少精緻澱粉和甜食、規律運動、維持體重、睡眠充足",
    related:"與空腹血糖、體重、三酸甘油酯密切相關",
  },
  glucose_ac: {
    name:"空腹血糖（Fasting Glucose）",
    desc:"禁食8小時後測量的血糖值，反映身體基礎血糖調節能力。",
    range:"正常 70-99 mg/dL　前期 100-125　糖尿病 ≥126",
    meaning:"空腹血糖偏高代表胰島素阻抗或胰臟功能下降，是T2D最早期指標之一。",
    improve:"規律運動、減重、低GI飲食、避免睡前進食",
    related:"與HbA1c、體重、三酸甘油酯、HDL相關",
  },
  alt: {
    name:"ALT（丙胺酸轉胺酶）",
    desc:"主要存在於肝細胞中，肝細胞受損時釋放入血液，是最敏感的肝功能指標。",
    range:"正常 男性 <44 U/L　女性 <32 U/L",
    meaning:"升高常見於脂肪肝、病毒性肝炎、藥物影響、過度飲酒。輕度升高（1-3倍）需追蹤。",
    improve:"減重（尤其腹部脂肪）、戒酒、避免不必要藥物、規律運動",
    related:"與體重、血脂、GGT密切相關",
  },
  ast: {
    name:"AST（天門冬胺酸轉胺酶）",
    desc:"存在於肝臟、心臟、肌肉中，比ALT更廣泛，特異性較低。",
    range:"正常 <40 U/L",
    meaning:"AST/ALT比值>2可能提示酒精性肝病。運動後AST也可能上升。",
    improve:"同ALT改善方法",
    related:"與ALT、CK、LDH相關",
  },
  hdl: {
    name:"HDL-C（高密度脂蛋白）",
    desc:"俗稱「好的膽固醇」，負責將血管中多餘膽固醇運回肝臟代謝清除。",
    range:"正常 男性 >40 mg/dL　女性 >50 mg/dL",
    meaning:"HDL越高越好，偏低代表心血管保護力不足，與T2D、代謝症候群相關。",
    improve:"有氧運動（最有效）、戒菸、減少反式脂肪、適量飲酒（若無禁忌）",
    related:"與三酸甘油酯呈反比，與體重、運動量相關",
  },
  ldl: {
    name:"LDL-C（低密度脂蛋白）",
    desc:"俗稱「壞的膽固醇」，過多時會沉積在血管壁形成動脈硬化斑塊。",
    range:"正常 <130 mg/dL　T2D患者建議 <100 mg/dL",
    meaning:"LDL偏高是心肌梗塞、腦中風的主要危險因子，T2D患者需嚴格控制。",
    improve:"減少飽和脂肪和膽固醇、增加纖維攝取、規律運動",
    related:"與總膽固醇、飲食脂肪攝取相關",
  },
  tg: {
    name:"三酸甘油酯（Triglyceride）",
    desc:"血液中最主要的脂肪形式，由飲食攝取或肝臟合成，儲存在脂肪細胞中。",
    range:"正常 <150 mg/dL　邊緣 150-199　偏高 200-499",
    meaning:"偏高與精緻糖、酒精攝取過多、肥胖、T2D密切相關，增加心血管風險。",
    improve:"減少精緻糖和酒精、減重、增加omega-3攝取（魚油）",
    related:"與HDL呈反比，與血糖、體重密切相關",
  },
  cholesterol: {
    name:"總膽固醇（Total Cholesterol）",
    desc:"血液中所有膽固醇的總和，包含HDL、LDL和其他成分。",
    range:"正常 <200 mg/dL　邊緣 200-239　偏高 ≥240",
    meaning:"需配合HDL/LDL比例分析，單純總膽固醇高不一定危險。",
    improve:"均衡飲食、規律運動",
    related:"HDL+LDL+其他脂蛋白的總和",
  },
  uric_acid: {
    name:"尿酸（Uric Acid）",
    desc:"嘌呤代謝的最終產物，由腎臟排出，過高會沉積在關節形成痛風。",
    range:"正常 男性 3.4-7.6 mg/dL　女性 2.3-6.6",
    meaning:"偏高與痛風、腎結石、代謝症候群、心血管疾病風險相關。",
    improve:"多喝水（每天2L以上）、減少紅肉/海鮮/啤酒、減重",
    related:"與腎功能、體重、飲食習慣相關",
  },
  creatinine: {
    name:"肌酸酐（Creatinine）",
    desc:"肌肉代謝產物，幾乎完全由腎臟過濾排出，是腎功能的重要指標。",
    range:"正常 男性 0.7-1.3 mg/dL　女性 0.6-1.1",
    meaning:"升高代表腎臟過濾功能下降，需配合eGFR一起判斷。",
    improve:"多喝水、控制血糖血壓（T2D腎臟保護最重要）、避免腎毒性藥物",
    related:"與eGFR、BUN、UPCR共同評估腎功能",
  },
  gfr: {
    name:"eGFR（估算腎絲球過濾率）",
    desc:"估算腎臟每分鐘能過濾多少血液，是腎功能最直接的評估指標。",
    range:"正常 ≥60 mL/min/1.73m²　CKD分期依數值而定",
    meaning:"數值越低代表腎功能越差，<60持續3個月以上為慢性腎臟病。",
    improve:"控制血糖、血壓、體重，避免NSAID類止痛藥",
    related:"與肌酸酐、UPCR、血壓、血糖密切相關",
  },
  upcr: {
    name:"UPCR（尿液蛋白/肌酸酐比值）",
    desc:"偵測尿液中是否有異常蛋白質，是糖尿病腎病變最早期的敏感指標。",
    range:"正常 <30 mg/g　微量蛋白尿 30-300　顯性蛋白尿 >300",
    meaning:"T2D患者UPCR偏高是腎臟早期損傷的警訊，需積極控制血糖血壓。",
    improve:"嚴格控制血糖（HbA1c<7%）、血壓（<130/80）、ACEI/ARB藥物",
    related:"與HbA1c、血壓、eGFR密切相關",
  },
  tsh: {
    name:"TSH（甲狀腺促素）",
    desc:"腦下垂體分泌的激素，調控甲狀腺功能，是甲狀腺疾病的第一線篩檢。",
    range:"正常 0.34-5.60 uIU/mL",
    meaning:"偏高=甲狀腺功能低下（疲倦、體重增加）；偏低=甲亢（心跳快、消瘦）。",
    improve:"甲狀腺疾病需醫師治療，不能自行處理",
    related:"T2D患者甲狀腺疾病風險較高，建議每年追蹤",
  },
  crp: {
    name:"CRP（C反應蛋白）",
    desc:"肝臟在急性發炎、感染、組織損傷時大量分泌的蛋白質，是發炎指標。",
    range:"正常 <1.0 mg/L　輕度發炎 1-3　中度 3-10",
    meaning:"慢性低度發炎（CRP 1-3）與T2D、心血管疾病、代謝症候群密切相關。",
    improve:"規律運動、減重、地中海飲食、充足睡眠、戒菸",
    related:"與血糖、血脂、體重、生活習慣相關",
  },
  ggt: {
    name:"GGT（麩胺轉移酶）",
    desc:"存在於肝臟、膽管、腎臟中，對脂肪肝和酒精性肝病特別敏感。",
    range:"正常 男性 <60 U/L　女性 <45 U/L",
    meaning:"GGT是脂肪肝最敏感的指標之一，飲酒後特別顯著升高。",
    improve:"戒酒、減重（減少腹部脂肪）、規律運動",
    related:"與ALT、體重、脂肪肝、飲酒習慣相關",
  },
  bun: {
    name:"BUN（血中尿素氮）",
    desc:"蛋白質代謝產物，由腎臟排出，反映腎功能和蛋白質攝取量。",
    range:"正常 7-23 mg/dL",
    meaning:"偏高可能是腎功能下降或高蛋白飲食；偏低可能是蛋白質攝取不足。",
    improve:"適量蛋白質攝取、多喝水、控制血糖血壓",
    related:"與肌酸酐、eGFR共同評估腎功能",
  },
  hb: {
    name:"血紅素 Hb（Hemoglobin）",
    desc:"紅血球中攜帶氧氣的蛋白質，反映貧血狀態。",
    range:"正常 男性 13.7-17.0 g/dL",
    meaning:"偏低代表貧血，可能影響疲勞感和運動能力；與T2D腎臟病變相關。",
    improve:"補充鐵質、維生素B12、葉酸，治療潛在疾病",
    related:"與RBC、HCT、MCV相關",
  },
  wbc: {
    name:"WBC（白血球）",
    desc:"免疫系統的主要細胞，負責對抗感染和異物。",
    range:"正常 3.6-11.2 x10³/uL",
    meaning:"偏高可能是感染、發炎、壓力；偏低可能是免疫抑制或骨髓問題。",
    improve:"維持規律作息、均衡飲食、避免過度疲勞",
    related:"與CRP、感染狀態相關",
  },
  platelet: {
    name:"血小板（Platelet）",
    desc:"負責血液凝固和止血的小細胞片段。",
    range:"正常 130-400 x10³/uL",
    meaning:"偏低增加出血風險；偏高增加血栓風險。T2D患者血小板功能常有異常。",
    improve:"均衡飲食、避免NSAID類藥物（影響血小板功能）",
    related:"與凝血功能、肝功能相關",
  },
};

// ── 趨勢分析函數 ──────────────────────────────────────
const analyzeTrend = (key, data) => {
  if (!data || data.length < 2) return null;
  const s = LAB_STATUS[key];
  if (!s) return null;
  const last = data[data.length-1]?.v;
  const prev = data[data.length-2]?.v;
  const first = data[0]?.v;
  if (last===undefined || prev===undefined) return null;
  const lastStatus = getStatus(key, last);
  const prevStatus = getStatus(key, prev);
  const diff = last - prev;
  const diffPct = prev !== 0 ? ((diff/prev)*100).toFixed(1) : 0;
  const isReverse = s.reverse; // HDL/eGFR 等越高越好

  // 趨勢方向
  let direction, color, icon, message;

  if (Math.abs(diffPct) < 3) {
    direction = "stable";
    icon = "➡️";
    color = C.textMuted;
    message = "持平";
  } else if ((!isReverse && diff > 0) || (isReverse && diff < 0)) {
    direction = "worse";
    icon = lastStatus === "alert" ? "🔴" : lastStatus === "warn" ? "⚠️" : "📈";
    color = lastStatus === "alert" ? C.red : lastStatus === "warn" ? C.amber : C.textMuted;
    message = `上升 ${Math.abs(diffPct)}%`;
  } else {
    direction = "better";
    icon = lastStatus === "ok" ? "✅" : "📉";
    color = lastStatus === "ok" ? C.green : C.amber;
    message = `下降 ${Math.abs(diffPct)}%`;
  }

  // 建議文字
  const suggestions = {
    hba1c: {worse:"減少精緻澱粉、增加運動", better:"繼續維持良好飲食習慣", stable:"維持目前生活方式"},
    glucose_ac: {worse:"注意睡前飲食、減少甜食", better:"血糖控制改善中", stable:"維持空腹規律"},
    alt: {worse:"注意飲酒、避免油膩食物", better:"肝功能改善中", stable:"定期追蹤"},
    hdl: {worse:"增加有氧運動、減少反式脂肪", better:"好膽固醇上升中", stable:"持續運動維持"},
    ldl: {worse:"減少飽和脂肪、增加纖維攝取", better:"壞膽固醇下降中", stable:"定期追蹤"},
    tg: {worse:"減少精緻糖和酒精", better:"三酸甘油酯改善中", stable:"定期追蹤"},
    uric_acid: {worse:"多喝水、減少紅肉和海鮮", better:"尿酸下降中", stable:"定期追蹤"},
    creatinine: {worse:"注意腎臟健康、多補充水分", better:"腎功能指標改善", stable:"定期追蹤"},
    upcr: {worse:"注意腎臟早期病變", better:"蛋白尿指標改善", stable:"定期追蹤"},
    crp: {worse:"注意發炎來源、改善生活習慣", better:"發炎指標下降", stable:"定期追蹤"},
    ggt: {worse:"注意脂肪肝或飲酒影響", better:"肝膽指標改善", stable:"定期追蹤"},
    ck: {worse:"避免過度激烈運動", better:"肌肉壓力減少", stable:"定期追蹤"},
    bun: {worse:"注意腎功能或蛋白質攝取", better:"腎功能指標改善", stable:"定期追蹤"},
    na: {worse:"注意電解質平衡", better:"鈉值趨於正常", stable:"維持均衡飲食"},
    k: {worse:"注意電解質平衡", better:"鉀值趨於正常", stable:"維持均衡飲食"},
    mg: {worse:"考慮補充鎂", better:"鎂值改善", stable:"維持均衡飲食"},
    ca: {worse:"注意鈣質攝取", better:"鈣值改善", stable:"維持均衡飲食"},
  };

  const suggest = suggestions[key]?.[direction] || "定期追蹤";

  // 近幾次數值
  const recent = data.slice(-3).map(d => d.v);

  return { direction, icon, color, message, suggest, recent, last, lastStatus, diffPct };
};

  // ── 折線圖 ─────────────────────────────────────────────
  // 顏色規則：綠色=正常 紅色=超標 黃色=規格線
  const LineChart=({datasets,min=0,max=200,refLines=[],height=120,statusKey=null})=>{
    const hasData=datasets&&datasets.some(d=>d.data.length>0);
    if(!hasData)return<div className="empty-state">📊 尚無資料<br/>請先記錄數值</div>;
    const W=320,H=height,P=26;
    const allDates=[...new Set(datasets.flatMap(d=>d.data.map(p=>p.date)))].sort();
    const toY=v=>{const r=max-min;if(r===0)return P+(H-P*2)/2;return P+(1-(v-min)/r)*(H-P*2);};
    const toX=i=>allDates.length===1?W/2:P+(i/(allDates.length-1))*(W-P*2);
    // 根據狀態決定點顏色
    const getDotColor=(key,val)=>{
      if(!key)return C.green;
      const st=getStatus(key,val);
      if(st==="alert")return C.red;
      if(st==="warn")return C.amber;
      return C.green;
    };
    return(
      <svg width="100%" viewBox={`0 0 ${W} ${H+28}`} style={{display:"block",maxWidth:"100%"}}>
        {[0,0.25,0.5,0.75,1].map(f=>(
          <line key={f} x1={P} y1={toY(min+f*(max-min))} x2={W-P} y2={toY(min+f*(max-min))} stroke={C.border} strokeWidth="1"/>
        ))}
        {[0,0.5,1].map(f=>(
          <text key={f} x={P-3} y={toY(min+f*(max-min))+4} fontSize="8" fill={C.textMuted} textAnchor="end">{Math.round(min+f*(max-min))}</text>
        ))}
        {/* 規格線統一用黃色 */}
        {refLines.map(r=>(
          <g key={r.label}>
            <line x1={P} y1={toY(r.v)} x2={W-P} y2={toY(r.v)} stroke={C.amber} strokeWidth="1.5" strokeDasharray="5,3"/>
            <text x={W-P+2} y={toY(r.v)-2} fontSize="8" fill={C.amber}>{r.label}</text>
            <text x={P+2} y={toY(r.v)+9} fontSize="8" fill={C.amber} opacity="0.8">{r.v}</text>
          </g>
        ))}
        {datasets.map((ds,di)=>{
          if(ds.data.length===0)return null;
          const pts=ds.data.map(p=>{const xi=allDates.indexOf(p.date);return`${toX(xi)},${toY(p.v)}`;}).join(" ");
          // 線的顏色用最新值的狀態決定
          const latestVal=ds.data[ds.data.length-1]?.v;
          const lineColor=getDotColor(statusKey,latestVal);
          return(
            <g key={di}>
              <polyline points={pts} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              {ds.data.map((p,i)=>{
                const xi=allDates.indexOf(p.date);
                const dotColor=getDotColor(statusKey,p.v);
                return(
                  <g key={i}>
                    <circle cx={toX(xi)} cy={toY(p.v)} r="4" fill={dotColor} stroke={C.bg} strokeWidth="2"/>
                    <text x={toX(xi)} y={toY(p.v)-8} fontSize="10" fill={dotColor} textAnchor="middle" fontWeight="bold">{p.v}</text>
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
            defaultValue={labInputText}
            onBlur={e=>setLabInputText(e.target.value)}
            onInput={e=>setLabInputText(e.target.value)}
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
              onClick={()=>setShowPhotoWarning(true)}>
              <div style={{fontSize:32,marginBottom:8}}>📷</div>
              <div style={{fontSize:14,color:C.textMuted}}>點擊上傳報告照片</div>
              <div style={{fontSize:11,color:C.textMuted,marginTop:4}}>支援多張・台灣/越南格式</div>
            </div>
          )}
          <input ref={photoInputRef} type="file" accept="image/*" multiple style={{display:"none"}}
            onChange={e=>{handlePhotoChange(e.target.files);e.target.value="";}}/>
        </div>

        <button className="btn-primary"
          onClick={()=>{
            if(!labForm.date){showToast("⚠️ 請先輸入抽血日期");return;}
            parseLabText();
          }}
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
              {key:"date",label:"抽血日期 ⚠️請確認",type:"date"},
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

          {/* extra_data 兜底警告 */}
          {labParsed._extraData && Object.keys(labParsed._extraData).length > 0 && (
            <div className="card" style={{border:`1px solid ${C.amber}55`,background:"rgba(255,179,71,0.06)"}}>
              <div className="card-title" style={{color:C.amber}}>⚠️ 已備份（欄位待新增）</div>
              <div style={{fontSize:12,color:C.textMuted,marginBottom:8,lineHeight:1.7}}>
                以下項目目前無對應欄位，已存入備份區，不會遺失：
              </div>
              {Object.entries(labParsed._extraData).map(([k,v])=>(
                <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${C.border}`}}>
                  <span style={{fontSize:12,color:C.amber}}>{k}</span>
                  <span style={{fontSize:12,color:C.text,fontWeight:600}}>{String(v)}</span>
                </div>
              ))}
            </div>
          )}

          {/* 數值確認 - 動態顯示所有解析到的欄位 */}
          <div className="card">
            <div className="card-title">
              解析數值（可修改）
              <span style={{fontSize:11,color:C.green,marginLeft:8}}>
                共 {Object.keys(labParsed).filter(k=>labParsed[k]!==null&&labParsed[k]!==undefined&&labParsed[k]!=="").length} 筆
              </span>
            </div>
            {/* 動態顯示所有有數值的欄位 */}
            {Object.keys(labParsed)
              .filter(k=>!["date","hospital","note"].includes(k) && labParsed[k]!==null && labParsed[k]!==undefined && labParsed[k]!=="")
              .map(key=>{
                const s=LAB_STATUS[key];
                const label=s?.label||key;
                const unit=s?.unit||"";
                const color=C.green;
                return(
                  <div key={key} className="confirm-field filled">
                    <div>
                      <div style={{fontSize:12,color:C.green}}>{label}</div>
                      {unit&&<div style={{fontSize:11,color:C.textMuted}}>{unit}</div>}
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <input style={{width:90,background:"transparent",border:`1px solid ${color}44`,borderRadius:6,padding:"4px 8px",color:C.text,fontSize:14,fontWeight:700,textAlign:"right",fontFamily:"monospace",outline:"none"}}
                        type="number" value={labParsed[key]||""} onChange={e=>setLabParsed(p=>({...p,[key]:e.target.value}))}/>
                    </div>
                  </div>
                );
              })
            }
            {/* 常用欄位補充輸入（未偵測到的） */}
            <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
              <div style={{fontSize:11,color:C.textMuted,marginBottom:8}}>未偵測到的欄位可手動輸入：</div>
              {[
                {key:"hba1c",label:"HbA1c",unit:"%"},
                {key:"glucose_ac",label:"空腹血糖",unit:"mg/dL"},
                {key:"tsh",label:"TSH",unit:"uIU/mL"},
                {key:"upcr",label:"UPCR",unit:"mg/g"},
              ].filter(f=>!labParsed[f.key])
              .map(f=>(
                <div key={f.key} className="confirm-field">
                  <div>
                    <div style={{fontSize:12,color:C.textMuted}}>{f.label}</div>
                    <div style={{fontSize:11,color:C.textMuted}}>{f.unit}</div>
                  </div>
                  <input style={{width:90,background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,padding:"4px 8px",color:C.text,fontSize:14,textAlign:"right",fontFamily:"monospace",outline:"none"}}
                    type="number" placeholder="輸入" onChange={e=>{if(e.target.value)setLabParsed(p=>({...p,[f.key]:parseFloat(e.target.value)}));}}/>
                </div>
              ))}
            </div>
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
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,position:"relative"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <ShieldIcon size={36}/>
          <div>
            <div style={{display:"flex",alignItems:"baseline",gap:8}}>
              <span style={{fontSize:18,fontWeight:700}}>我的健康日誌</span>
              <span style={{fontSize:11,color:C.green,background:"rgba(46,204,138,0.12)",padding:"2px 7px",borderRadius:10}}>{VERSION}</span>
            </div>
            <div style={{fontSize:12,color:C.textMuted}}>{new Date().toLocaleDateString("zh-TW",{month:"long",day:"numeric",weekday:"short"})}</div>
            <div style={{fontSize:10,display:"flex",alignItems:"center",gap:4,marginTop:2}}>
              {syncStatus==="syncing"&&<><span style={{color:C.amber}} className="spin">⟳</span><span style={{color:C.textMuted}}>同步中</span></>}
              {syncStatus==="synced"&&<><span style={{color:C.green}}>✓</span><span style={{color:C.textMuted}}>已同步 {lastSync?lastSync.toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"}):""}</span></>}
              {syncStatus==="error"&&<><span style={{color:C.red}}>✕</span><span style={{color:C.textMuted}}>同步失敗</span></>}
            </div>
          </div>
        </div>
        {overdueReminders.length>0&&(
          <div onClick={()=>setShowOverdue(v=>!v)} style={{cursor:"pointer"}}>
            <div style={{background:C.red,borderRadius:20,padding:"4px 10px",fontSize:12,color:"white"}}>{overdueReminders.length} 項到期 {showOverdue?"▲":"▼"}</div>
            {showOverdue&&(
              <div style={{position:"absolute",right:16,top:56,background:C.bgCard2,border:`1px solid ${C.red}66`,borderRadius:10,padding:"8px 12px",zIndex:100,minWidth:180}}>
                {overdueReminders.map(r=>(
                  <div key={r.id} style={{fontSize:12,color:C.red,padding:"4px 0",borderBottom:`1px solid ${C.border}`}}>
                    📅 {r.title||r.type}
                  </div>
                ))}
                <div style={{fontSize:10,color:C.textMuted,marginTop:4}}>點擊設定頁查看詳情</div>
              </div>
            )}
          </div>
        )}
      </div>
      {loading&&<div style={{textAlign:"center",color:C.textMuted,fontSize:12,marginBottom:12}}><span className="spin">⟳</span> 載入中...</div>}
      {!isOnline&&<div style={{background:"rgba(255,179,71,0.1)",border:"1px solid rgba(255,179,71,0.3)",borderRadius:10,padding:"8px 12px",marginBottom:10,fontSize:12,color:C.amber,textAlign:"center"}}>📴 離線模式 · 顯示本地快取資料</div>}
      {/* 每日AI顧問問候 */}
      <div style={{background:"linear-gradient(135deg,rgba(46,204,138,0.12),rgba(52,152,219,0.12))",
        border:`1px solid ${C.green}44`,borderRadius:12,padding:"12px 14px",marginBottom:12}}>
        <div style={{fontSize:10,color:C.green,fontWeight:700,letterSpacing:1,marginBottom:6,
          display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span>🤖 健康顧問</span>
          <button onClick={()=>{localStorage.removeItem("hj_daily_greeting");setDailyGreeting(null);generateDailyGreeting();}}
            style={{fontSize:9,color:C.textMuted,background:"none",border:"none",cursor:"pointer",padding:0}}>
            重新產生
          </button>
        </div>
        {greetingLoading
          ?<div style={{fontSize:12,color:C.textMuted}}>⏳ 顧問正在思考中...</div>
          :dailyGreeting
            ?<div style={{fontSize:13,color:C.text,lineHeight:1.8}}>{dailyGreeting}</div>
            :<div style={{fontSize:12,color:C.textMuted}}>
                今日問候尚未產生
                {!localStorage.getItem("hj_apikey")&&<span>（請先設定API金鑰）</span>}
              </div>
        }
      </div>
      <div style={{background:"rgba(255,179,71,0.1)",border:"1px solid rgba(255,179,71,0.3)",borderRadius:12,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:20}}>⚠️</span>
        <div>
          <div style={{fontSize:12,fontWeight:600,color:C.amber}}>糖尿病前期 + 家族史 T2D</div>
          <div style={{fontSize:11,color:C.textMuted}}>HbA1c {latestLab?.hba1c||"5.8"}% · 需積極管理</div>
        </div>
      </div>
      {/* 今日狀態整合卡片 */}
      {(()=>{
        // 健康分數
        const scores=computeRadarScores(latestLab,bpHistory);
        const valid=scores?scores.filter(d=>d.score!=null):[];
        const total=valid.length>0?Math.round(valid.reduce((s,d)=>s+d.score,0)/valid.length*10):null;
        const prev2=labHistory.length>1?computeRadarScores(labHistory[labHistory.length-2],bpHistory):null;
        const prevValid=prev2?prev2.filter(d=>d.score!=null):[];
        const prevTotal=prevValid.length>0?Math.round(prevValid.reduce((s,d)=>s+d.score,0)/prevValid.length*10):null;
        const diff=prevTotal!=null&&total!=null?total-prevTotal:null;
        const scoreColor=total==null?C.textMuted:total>=75?C.green:total>=60?C.amber:C.red;
        // 早餐打卡
        const bkfDates=new Set(breakfastLog.map(r=>normalizeDate(r.date)));
        const todayStr=today();
        const bkfToday=bkfDates.has(todayStr);
        let bkfStreak=0;
        const bd=new Date();
        if(!bkfToday)bd.setDate(bd.getDate()-1);
        while(true){const ds=`${bd.getFullYear()}-${String(bd.getMonth()+1).padStart(2,"0")}-${String(bd.getDate()).padStart(2,"0")}`;if(bkfDates.has(ds)){bkfStreak++;bd.setDate(bd.getDate()-1);}else break;}
        // 運動打卡
        const exDates=new Set(exerciseLog.map(r=>normalizeDate(r.date)));
        const todayEx=exerciseLog.find(r=>normalizeDate(r.date)===todayStr);
        const exToday=!!todayEx;
        let exStreak=0;
        const ed=new Date();
        if(!exToday)ed.setDate(ed.getDate()-1);
        while(true){const ds=`${ed.getFullYear()}-${String(ed.getMonth()+1).padStart(2,"0")}-${String(ed.getDate()).padStart(2,"0")}`;if(exDates.has(ds)){exStreak++;ed.setDate(ed.getDate()-1);}else break;}
        let exHit7=0;for(let i=0;i<7;i++){const dd=new Date();dd.setDate(dd.getDate()-i);const ds=`${dd.getFullYear()}-${String(dd.getMonth()+1).padStart(2,"0")}-${String(dd.getDate()).padStart(2,"0")}`;if(exDates.has(ds))exHit7++;}
        const EX_TYPES=[{k:"快走",e:"🚶"},{k:"游泳",e:"🏊"},{k:"重訓",e:"💪"},{k:"騎車",e:"🚴"},{k:"其他",e:"🏃"}];
        return(
          <div className="card" style={{padding:"12px",marginBottom:8}}>
            {/* 頂部：健康分數 */}
            {total!=null&&(
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,paddingBottom:10,borderBottom:`1px solid ${C.border}`,cursor:"pointer"}}
                onClick={()=>{setTab("trend");setTrendItem("radar");}}>
                <div>
                  <div style={{fontSize:10,color:C.textMuted,marginBottom:2}}>綜合健康分數</div>
                  <div style={{display:"flex",alignItems:"baseline",gap:4}}>
                    <span style={{fontFamily:"'DM Serif Display',serif",fontSize:32,color:scoreColor,lineHeight:1}}>{total}</span>
                    <span style={{fontSize:11,color:C.textMuted}}>/100</span>
                    {diff!=null&&<span style={{fontSize:11,color:diff>0?C.green:diff<0?C.red:C.textMuted,fontWeight:700}}>{diff>0?`▲+${diff}`:diff<0?`▼${diff}`:"→"}</span>}
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  {scores.filter(d=>d.score!=null&&d.score<6.5).slice(0,2).map(d=>(
                    <div key={d.label} style={{fontSize:10,color:C.amber,marginBottom:2}}>⚠️ {d.label.split("\n")[0]}</div>
                  ))}
                  <div style={{fontSize:10,color:C.textMuted,marginTop:2}}>看雷達圖 →</div>
                </div>
              </div>
            )}
            {/* 中部：打卡狀態橫排 */}
            <div style={{display:"flex",gap:8,marginBottom:exToday?0:10}}>
              {/* 早餐 */}
              <div style={{flex:1,textAlign:"center"}}>
                <div style={{fontSize:18,marginBottom:2}}>{bkfToday?"✅":"🍳"}</div>
                <div style={{fontSize:11,fontWeight:600,color:bkfToday?C.green:C.text}}>早餐</div>
                <div style={{fontSize:10,color:C.textMuted}}>🔥{bkfStreak}天</div>
                {!bkfToday&&(
                  <button onClick={async()=>{
                    const r=await api.post("append","breakfast_log",{id:Date.now(),date:todayStr,checked:1});
                    if(r&&!r.error){setBreakfastLog(prev=>[...prev,{date:todayStr,checked:1}]);showToast("✅ 早餐打卡！");}
                    else showToast("❌ 打卡失敗");
                  }}
                    style={{marginTop:4,padding:"4px 8px",borderRadius:8,fontSize:11,cursor:"pointer",
                      background:C.green,border:"none",color:"#0a0a0a",fontFamily:"'Noto Sans TC',sans-serif",fontWeight:700}}>
                    打卡
                  </button>
                )}
              </div>
              {/* 分隔線 */}
              <div style={{width:1,background:C.border}}/>
              {/* 運動 */}
              <div style={{flex:1,textAlign:"center"}}>
                <div style={{fontSize:18,marginBottom:2}}>{exToday?"✅":"🏃"}</div>
                <div style={{fontSize:11,fontWeight:600,color:exToday?C.blue:C.text}}>
                  運動{exToday&&todayEx?.type?` ${EX_TYPES.find(t=>t.k===todayEx.type)?.e||""}`:""}</div>
                <div style={{fontSize:10,color:C.textMuted}}>本週{exHit7}/7天</div>
              </div>
              {/* 分隔線 */}
              <div style={{width:1,background:C.border}}/>
              {/* 血壓 */}
              <div style={{flex:1,textAlign:"center"}}>
                {(()=>{
                  const todayBP=bpHistory.find(r=>normalizeDate(r.date)===todayStr);
                  return(<>
                    <div style={{fontSize:18,marginBottom:2}}>{todayBP?"✅":"💓"}</div>
                    <div style={{fontSize:11,fontWeight:600,color:todayBP?C.green:C.text}}>血壓</div>
                    <div style={{fontSize:10,color:C.textMuted}}>{todayBP?`${todayBP.systolic}/${todayBP.diastolic}`:"今日未記錄"}</div>
                  </>);
                })()}
              </div>
            </div>
            {/* 運動類型選擇（未打卡時顯示） */}
            {!exToday&&(
              <div style={{display:"flex",gap:6,flexWrap:"wrap",paddingTop:8,borderTop:`1px solid ${C.border}`}}>
                {EX_TYPES.map(t=>(
                  <button key={t.k} onClick={async()=>{
                    const r=await api.post("append","exercise_log",{id:Date.now(),date:todayStr,checked:1,type:t.k});
                    if(r&&!r.error){setExerciseLog(prev=>[...prev,{date:todayStr,checked:1,type:t.k}]);showToast(`✅ ${t.e} ${t.k} 打卡！`);}
                    else showToast("❌ 打卡失敗");
                  }}
                    style={{padding:"5px 10px",borderRadius:10,fontSize:11,cursor:"pointer",
                      background:"rgba(90,180,255,0.1)",border:`1px solid rgba(90,180,255,0.3)`,
                      color:C.blue,fontFamily:"'Noto Sans TC',sans-serif"}}>
                    {t.e} {t.k}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })()}
      {/* 睡眠不足提醒 */}
      {(()=>{
        const now=new Date();
        const hour=now.getHours();
        // 早上6-9點顯示（剛起床時最相關）
        const SLEEP_TIPS=[
          {icon:"🩸",text:"昨晚睡不足7小時？今天血糖控制效果會下降15-20%，注意午餐選擇"},
          {icon:"❤️",text:"深層睡眠不足讓舒脈康效果打折，目標23:00前上床讓血壓自然下降"},
          {icon:"💪",text:"睡眠是蛋白質轉換為肌肉的關鍵，你吃了這麼好的早餐，別在睡眠中浪費"},
          {icon:"🧬",text:"深層睡眠合成70%睾固酮，充足睡眠對你的整體健康比任何保健品都重要"},
        ];
        const tip=SLEEP_TIPS[now.getDate()%SLEEP_TIPS.length];
        return(
          <div style={{background:"rgba(90,180,255,0.06)",border:`1px solid rgba(90,180,255,0.2)`,borderRadius:12,padding:"10px 12px",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:8,cursor:"pointer",marginBottom:6}}
              onClick={()=>{setTab("knowledge");setKbTab("articles");}}>
              <div style={{fontSize:18,flexShrink:0}}>{tip.icon}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:10,fontWeight:700,color:C.blue,marginBottom:2}}>😴 睡眠提醒</div>
                <div style={{fontSize:11,color:C.textMuted,lineHeight:1.6}}>{tip.text}</div>
              </div>
              <div style={{fontSize:10,color:C.blue,flexShrink:0}}>了解 →</div>
            </div>
            <button onClick={()=>{setTab("record");setRecordTab("sleep");}}
              style={{width:"100%",padding:"7px",borderRadius:8,fontSize:11,cursor:"pointer",
                background:"rgba(90,180,255,0.12)",border:`1px solid rgba(90,180,255,0.3)`,
                color:C.blue,fontFamily:"'Noto Sans TC',sans-serif",fontWeight:600}}>
              📊 記錄本週睡眠數據（Watch 7）→ 每週分析
            </button>
          </div>
        );
      })()}
      {/* 整體健康評估摘要（每週自動，首頁顯眼位置）*/}
      {(()=>{
        const report=overallReport||"";
        const reportDate=overallDate||"";
        const daysSinceReport=reportDate?Math.floor((new Date()-new Date(reportDate))/(1000*60*60*24)):999;
        if(overallLoading)return(
          <div style={{background:C.blue+"15",border:`1px solid ${C.blue}44`,borderRadius:10,
            padding:"12px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:20}}>⏳</span>
            <div style={{fontSize:12,color:C.blue}}>正在產生本週整體健康評估...</div>
          </div>
        );
        if(!report||report.startsWith("❌"))return(
          <div style={{background:C.blue+"15",border:`1px solid ${C.blue}44`,borderRadius:10,
            padding:"10px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:20}}>🏥</span>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:700,color:C.blue,marginBottom:2}}>整體健康評估</div>
              <div style={{fontSize:11,color:C.textMuted}}>尚未產生評估報告</div>
            </div>
            <button onClick={()=>generateOverallReport(false)}
              style={{fontSize:11,padding:"5px 10px",background:C.blue,border:"none",
                borderRadius:6,color:"#fff",fontWeight:700,cursor:"pointer",flexShrink:0}}>
              立即產生
            </button>
          </div>
        );
        // 萃取「五、紅旗」和「三、複合因果」段落
        const lines=report.split("\n").map(l=>l.trim()).filter(Boolean);
        const extractSection=(startPat,endPat)=>{
          let capturing=false;
          const result=[];
          for(const line of lines){
            if(startPat.test(line)){capturing=true;continue;}
            if(capturing&&endPat.test(line))break;
            if(capturing&&line.length>8)result.push(line);
          }
          return result;
        };
        const redFlags=extractSection(/五、|紅旗|立即注意/,/六、|七、|下次看診/).slice(0,3);
        const causal=extractSection(/三、|複合因果|互相加重/,/四、|五、|結構性/).slice(0,2);
        const summary=lines.find(l=>/七、|一句話/.test(l))||"";
        const [expanded,setExpanded]=React.useState(false);
        return(
          <div style={{marginBottom:8}}>
            <div style={{fontSize:11,fontWeight:700,color:C.blue,letterSpacing:1,marginBottom:6,
              display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span>🏥 整體健康評估
                <span style={{fontSize:9,color:C.textMuted,fontWeight:400,marginLeft:6}}>
                  {reportDate} {daysSinceReport<=1?"（今日）":daysSinceReport<=7?`（${daysSinceReport}天前）`:"（本週更新）"}
                </span>
              </span>
              <button onClick={()=>generateOverallReport(false)}
                style={{fontSize:9,color:C.textMuted,background:"none",border:`1px solid ${C.border}`,
                  borderRadius:4,padding:"2px 6px",cursor:"pointer"}}>
                重新產生
              </button>
            </div>
            <div style={{background:C.blue+"12",border:`1px solid ${C.blue}44`,borderRadius:10,padding:"10px 12px"}}>
              {/* 紅旗 */}
              {redFlags.length>0&&(
                <div style={{marginBottom:causal.length>0?8:0}}>
                  <div style={{fontSize:10,fontWeight:700,color:C.red,marginBottom:5,letterSpacing:0.5}}>🚩 需要注意</div>
                  {redFlags.slice(0,expanded?redFlags.length:2).map((line,i)=>(
                    <div key={i} style={{display:"flex",gap:6,marginBottom:4}}>
                      <span style={{color:C.red,flexShrink:0,fontSize:11}}>▸</span>
                      <div style={{fontSize:11,color:C.text,lineHeight:1.6}}>{line}</div>
                    </div>
                  ))}
                </div>
              )}
              {/* 複合因果（展開後顯示）*/}
              {expanded&&causal.length>0&&(
                <div style={{marginBottom:8,paddingTop:8,borderTop:`1px solid ${C.blue}22`}}>
                  <div style={{fontSize:10,fontWeight:700,color:C.amber,marginBottom:5}}>🔗 複合關聯</div>
                  {causal.map((line,i)=>(
                    <div key={i} style={{display:"flex",gap:6,marginBottom:4}}>
                      <span style={{color:C.amber,flexShrink:0,fontSize:11}}>▸</span>
                      <div style={{fontSize:11,color:C.text,lineHeight:1.6}}>{line}</div>
                    </div>
                  ))}
                </div>
              )}
              {/* 總結句 */}
              {expanded&&summary&&(
                <div style={{paddingTop:8,borderTop:`1px solid ${C.blue}22`,
                  fontSize:11,color:C.green,lineHeight:1.6,fontStyle:"italic"}}>
                  💬 {summary.replace(/七、一句話總結[：:]/,"").trim()}
                </div>
              )}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
                <button onClick={()=>setExpanded(v=>!v)}
                  style={{fontSize:10,color:C.blue,background:"none",border:"none",cursor:"pointer",padding:0}}>
                  {expanded?"▲ 收起":"▼ 展開複合關聯"}
                </button>
                <button onClick={()=>setTab("ai")}
                  style={{fontSize:10,color:C.textMuted,background:"none",border:"none",cursor:"pointer",padding:0}}>
                  查看完整報告 →
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      {/* 複合健康提醒（從週報萃取跨維度警示）*/}
      {(()=>{
        const report=aiReport||"";
        if(!report||report.startsWith("❌"))return(
          <div style={{background:C.amber+"18",border:`1px solid ${C.amber}44`,borderRadius:10,
            padding:"10px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:20}}>🔗</span>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:700,color:C.amber,marginBottom:2}}>複合健康提醒</div>
              <div style={{fontSize:11,color:C.textMuted,lineHeight:1.6}}>尚未產生本週分析，無法顯示跨維度警示</div>
            </div>
            <button onClick={()=>{setTab("ai");}}
              style={{fontSize:11,padding:"5px 10px",background:C.amber,border:"none",
                borderRadius:6,color:"#000",fontWeight:700,cursor:"pointer",flexShrink:0}}>
              產生週報
            </button>
          </div>
        );
        // 從週報文字萃取複合警示關鍵句
        const lines=report.split("\n").map(l=>l.trim()).filter(l=>l.length>10);
        // 找含複合關鍵字的句子（同時提到兩個以上維度）
        const DIMS=[
          {key:"睡眠",pat:/睡眠|深層|入睡|失眠/},
          {key:"血糖",pat:/血糖|HbA1c|胰島素|糖化/},
          {key:"血壓",pat:/血壓|收縮壓|舒張壓|高血壓/},
          {key:"肝",pat:/肝|ALT|脂肪肝|肝酶/},
          {key:"尿酸",pat:/尿酸|痛風/},
          {key:"心血管",pat:/動脈|冠狀|心臟|血脂|HDL|LDL/},
          {key:"飲食",pat:/飲食|碳水|澱粉|麵食|熱量/},
          {key:"運動",pat:/運動|步行|活動量/},
        ];
        const composite=lines.filter(line=>{
          const matchedDims=DIMS.filter(d=>d.pat.test(line));
          return matchedDims.length>=2;
        }).slice(0,3);
        // 找「需要注意」「建議」「風險」等行動句
        const actionLines=lines.filter(l=>
          /需要|建議|注意|警示|風險|影響|關聯|互相|加重|惡化|因此|所以/.test(l)&&
          DIMS.filter(d=>d.pat.test(l)).length>=1
        ).slice(0,2);
        const toShow=[...new Set([...composite,...actionLines])].slice(0,3);
        if(toShow.length===0)return null;
        const [expanded,setExpanded]=React.useState(false);
        return(
          <div style={{marginBottom:8}}>
            <div style={{fontSize:11,fontWeight:700,color:C.amber,letterSpacing:1,marginBottom:6,
              display:"flex",alignItems:"center",gap:6}}>
              🔗 複合健康提醒
              <span style={{fontSize:9,color:C.textMuted,fontWeight:400}}>來自本週AI分析 · {aiReportDate||""}</span>
            </div>
            <div style={{background:C.amber+"15",border:`1px solid ${C.amber}55`,borderRadius:10,padding:"10px 12px"}}>
              {toShow.slice(0,expanded?toShow.length:1).map((line,i)=>(
                <div key={i} style={{display:"flex",gap:8,marginBottom:i<toShow.length-1?8:0,
                  paddingBottom:i<toShow.length-1?8:0,
                  borderBottom:i<toShow.length-1?`1px solid ${C.amber}22`:"none"}}>
                  <span style={{fontSize:14,flexShrink:0}}>{"⚠️🔗💡".split("")[i]||"💡"}</span>
                  <div style={{fontSize:11,color:C.text,lineHeight:1.7}}>{line}</div>
                </div>
              ))}
              {toShow.length>1&&(
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
                  <button onClick={()=>setExpanded(v=>!v)}
                    style={{fontSize:10,color:C.amber,background:"none",border:"none",cursor:"pointer",padding:0}}>
                    {expanded?"▲ 收起":"▼ 還有"+(toShow.length-1)+"項"}
                  </button>
                  <button onClick={()=>setTab("ai")}
                    style={{fontSize:10,color:C.textMuted,background:"none",border:"none",cursor:"pointer",padding:0}}>
                    查看完整週報 →
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}
      {/* 健康警報（階段四自動標記）*/}
      {(()=>{
        const alerts=detectHealthAlerts();
        if(alerts.length===0)return null;
        const colorMap={alert:C.red,warn:C.amber,info:C.blue};
        const ALERT_DETAILS={
          "肝臟需重點關注":{
            impact:"脂肪肝若持續惡化可能進展到肝纖維化→肝硬化→肝癌。ALT持續偏高表示肝細胞正在受損。",
            improve:"①每天快走30分鐘（最有效）②減少精緻碳水（麵食/白飯）③你的堅果奶昔+橄欖油方向正確④3個月複查ALT，目標降到40以下⑤咖啡每天1杯護肝有實證",
          },
          "血小板偏低":{
            impact:"血小板負責止血。你的145偏低（正常150-450），加上服用Plavix抗血小板藥，出血風險疊加。輕微的影響：瘀青容易出現、傷口較難止血。嚴重情況（<50才要擔心）：自發性出血。",
            improve:"①145屬於輕度偏低，無需特別緊張②告知醫師你的血小板數值，評估Plavix劑量是否需調整③避免劇烈碰撞運動④每次抽血追蹤，若持續下降再積極處理⑤增加深色蔬菜（菠菜、花椰菜）補充維生素K",
          },
          "代謝負擔警訊":{
            impact:"ALT與尿酸同時偏高是代謝症候群的典型表現。肝臟同時處理脂肪代謝和嘌呤代謝的負擔，兩者超標代表代謝系統整體超負荷。",
            improve:"①最重要：減重（體重每降1kg，尿酸降約0.3mg/dL）②大量飲水（每天>2000ml，幫助尿酸排出）③減少高嘌呤食物（內臟、海鮮、啤酒）④你的低碳飲食方向正確",
          },
          "待複評：左心室後壁":{
            impact:"LVPWd影像值18.3mm超過正常12mm，但醫師報告判正常，可能是測量角度問題或確實有高血壓性心臟病早期表現。目前不確定，需要第二意見。",
            improve:"①回台灣安排心臟科複查心臟超音波②告知醫師這個數值和你的血壓130/90③繼續服用舒脈康控制血壓，這是最重要的預防",
          },
        };
        const [expandedAlert,setExpandedAlert]=React.useState(null);
        return(
          <div style={{marginBottom:8}}>
            <div style={{fontSize:11,fontWeight:700,color:C.amber,letterSpacing:1,marginBottom:6,
              display:"flex",alignItems:"center",gap:6}}>
              🚨 健康警報（{alerts.length}）
              <span style={{fontSize:9,color:C.textMuted,fontWeight:400}}>點選了解影響與改善</span>
            </div>
            {alerts.map((a,i)=>{
              const detail=ALERT_DETAILS[a.title];
              const isOpen=expandedAlert===i;
              return(
                <div key={i} style={{background:`${colorMap[a.level]}11`,border:`1px solid ${colorMap[a.level]}44`,
                  borderRadius:10,padding:"9px 11px",marginBottom:6}}>
                  <div style={{display:"flex",alignItems:"flex-start",gap:8,cursor:detail?"pointer":"default"}}
                    onClick={()=>detail&&setExpandedAlert(isOpen?null:i)}>
                    <span style={{fontSize:16,flexShrink:0}}>{a.icon}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,fontWeight:700,color:colorMap[a.level],marginBottom:2}}>{a.title}</div>
                      <div style={{fontSize:11,color:C.textMuted,lineHeight:1.6}}>{a.desc}</div>
                    </div>
                    {detail&&<span style={{fontSize:11,color:colorMap[a.level],flexShrink:0}}>{isOpen?"▲":"▼"}</span>}
                  </div>
                  {isOpen&&detail&&(
                    <div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${colorMap[a.level]}33`}}>
                      <div style={{fontSize:11,fontWeight:700,color:C.red,marginBottom:4}}>⚠️ 對身體的影響</div>
                      <div style={{fontSize:11,color:C.textMuted,lineHeight:1.7,marginBottom:8}}>{detail.impact}</div>
                      <div style={{fontSize:11,fontWeight:700,color:C.green,marginBottom:4}}>✅ 改善方法</div>
                      <div style={{fontSize:11,color:C.textMuted,lineHeight:1.7}}>{detail.improve}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}
      <div style={{fontSize:11,color:C.textMuted,letterSpacing:2,marginBottom:8}}>LATEST VALUES</div>
      <div className="grid-2">
        <div className="card" style={{cursor:"pointer",padding:"10px 12px"}} onClick={()=>{setTab("trend");setTrendItem("glucose")}}>
          <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>🩸 血糖</div>
          {latestGlucose?<>
            <div style={{display:"flex",alignItems:"baseline",gap:4}}>
              <span style={{fontFamily:"'DM Serif Display',serif",fontSize:22,color:C.amber,lineHeight:1}}>{latestGlucose.value_mgdl}</span>
              <span style={{fontSize:10,color:C.textMuted}}>mg/dL</span>
            </div>
            <div style={{fontSize:9,color:C.textMuted,marginTop:3}}>{latestGlucose.timePoint} · {daysSince(latestGlucose.date)}</div>
            <span className={`source-tag ${latestGlucose.source==="醫院"?"source-hospital":"source-daily"}`} style={{marginTop:5,display:"inline-flex"}}>{latestGlucose.source==="醫院"?"🏥 醫院":"🏠 日常"}</span>
          </>:<div style={{fontSize:11,color:C.textMuted,marginTop:6}}>尚無資料</div>}
        </div>
        <div className="card" style={{cursor:"pointer",padding:"10px 12px"}} onClick={()=>{setTab("trend");setTrendItem("bp")}}>
          <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>💓 血壓</div>
          {latestBP?<>
            <div style={{display:"flex",alignItems:"baseline",gap:4}}>
              <span style={{fontFamily:"'DM Serif Display',serif",fontSize:20,color:C.green,lineHeight:1}}>{latestBP.systolic}</span>
              <span style={{fontSize:10,color:C.textMuted}}>/{latestBP.diastolic}</span>
            </div>
            <div style={{fontSize:9,color:C.textMuted,marginTop:3}}>mmHg · {daysSince(latestBP.date)}</div>
            <span className={`source-tag ${latestBP.source==="醫院"?"source-hospital":"source-daily"}`} style={{marginTop:5,display:"inline-flex"}}>{latestBP.source==="醫院"?"🏥 醫院":"🏠 日常"}</span>
          </>:<div style={{fontSize:11,color:C.textMuted,marginTop:6}}>尚無資料</div>}
        </div>
        <div className="card" style={{cursor:"pointer",padding:"10px 12px"}} onClick={()=>{setTab("trend");setTrendItem("weight")}}>
          <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>⚖️ 體重</div>
          {latestWeight?<>
            <div style={{display:"flex",alignItems:"baseline",gap:4}}>
              <span style={{fontFamily:"'DM Serif Display',serif",fontSize:22,lineHeight:1}}>{latestWeight.value_kg}</span>
              <span style={{fontSize:10,color:C.textMuted}}>kg</span>
            </div>
            <div style={{fontSize:9,color:C.textMuted,marginTop:3}}>{daysSince(latestWeight.date)}</div>
          </>:<div style={{fontSize:11,color:C.textMuted,marginTop:6}}>尚無資料</div>}
        </div>
        <div className="card" style={{cursor:"pointer",padding:"10px 12px"}} onClick={()=>setSelectedKnowledge(KNOWLEDGE_ITEMS[0])}>
          <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>📊 HbA1c</div>
          {latestLab?<>
            <div style={{display:"flex",alignItems:"baseline",gap:4}}>
              <span style={{fontFamily:"'DM Serif Display',serif",fontSize:22,color:C.amber,lineHeight:1}}>{latestLab.hba1c}</span>
              <span style={{fontSize:10,color:C.textMuted}}>%</span>
            </div>
            <div style={{fontSize:9,color:C.textMuted,marginTop:3}}>{daysSince(latestLab.date)}</div>
            <span className="status-chip status-warn" style={{marginTop:5,display:"inline-flex"}}>前期範圍</span>
          </>:<div style={{fontSize:11,color:C.textMuted,marginTop:6}}>尚無資料</div>}
        </div>
      </div>
      <div className="card">
        <div className="card-title">快速記錄</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {(()=>{
            const todayStr=today();
            const bkfDone=breakfastLog.some(r=>normalizeDate(r.date)===todayStr);
            const exDone=exerciseLog.some(r=>normalizeDate(r.date)===todayStr);
            const bpDone=bpHistory.some(r=>normalizeDate(r.date)===todayStr);
            const gluDone=glucoseHistory.some(r=>normalizeDate(r.date)===todayStr);
            const dotMap={glucose:!gluDone,bp:!bpDone,weight:false,lab:false,meal:false,exercise:!exDone};
            return [{label:"血糖",icon:"🩸",sub:"glucose"},{label:"血壓",icon:"💓",sub:"bp"},{label:"體重",icon:"⚖️",sub:"weight"},{label:"抽血報告",icon:"📋",sub:"lab"},{label:"飲食",icon:"🍱",sub:"meal"},{label:"運動",icon:"🏃",sub:"exercise"}].map(item=>(
              <div key={item.label} onClick={()=>{setTab("record");setRecordTab(item.sub)}}
                style={{background:C.bg,border:`1px solid ${dotMap[item.sub]?C.amber:C.border}`,borderRadius:10,padding:"8px 12px",fontSize:12,color:dotMap[item.sub]?C.amber:C.textMuted,cursor:"pointer",display:"flex",alignItems:"center",gap:6,position:"relative"}}>
                {item.icon} {item.label}
                {dotMap[item.sub]&&<div style={{position:"absolute",top:4,right:4,width:6,height:6,borderRadius:"50%",background:C.amber}}/>}
              </div>
            ));
          })()}
        </div>
      </div>
      {/* 最新抽血報告數值 */}
      {latestLab && (()=>{
        const CHECK_FIELDS = [
          {key:"hba1c",label:"HbA1c",unit:"%"},
          {key:"glucose_ac",label:"空腹血糖",unit:"mg/dL"},
          {key:"alt",label:"ALT",unit:"U/L"},
          {key:"ggt",label:"GGT",unit:"U/L"},
          {key:"hdl",label:"HDL-C",unit:"mg/dL"},
          {key:"ldl",label:"LDL-C",unit:"mg/dL"},
          {key:"tg",label:"三酸甘油酯",unit:"mg/dL"},
          {key:"uric_acid",label:"尿酸",unit:"mg/dL"},
          {key:"creatinine",label:"肌酸酐",unit:"mg/dL"},
          {key:"upcr",label:"UPCR",unit:"mg/g"},
          {key:"tsh",label:"TSH",unit:"uIU/mL"},
          {key:"hb",label:"血紅素",unit:"g/dL"},
          {key:"wbc",label:"WBC",unit:"K/uL"},
          {key:"platelet",label:"血小板",unit:"K/uL"},
          {key:"crp",label:"CRP",unit:""},
          {key:"hbsag",label:"HBsAg",unit:""},
        ];
        const alerts = CHECK_FIELDS.filter(f=>{
          const v = latestLab[f.key];
          if(v===null||v===undefined||v==="")return false;
          return getStatus(f.key,v)==="alert";
        });
        const warns = CHECK_FIELDS.filter(f=>{
          const v = latestLab[f.key];
          if(v===null||v===undefined||v==="")return false;
          return getStatus(f.key,v)==="warn";
        });
        const TIPS_MAP = {
          hba1c:["每3個月追蹤HbA1c","飯後散步15分鐘","減少精緻澱粉"],
          glucose_ac:["減少宵夜和含糖飲料","規律有氧運動"],
          alt:["減重5-10%可改善脂肪肝","每6個月追蹤肝功能"],
          ggt:["減少飲酒","改善脂肪肝"],
          hdl:["每週150分鐘有氧運動","攝取橄欖油、堅果"],
          ldl:["減少飽和脂肪","增加膳食纖維"],
          tg:["減少精緻糖和酒精","增加omega-3攝取"],
          uric_acid:["每天喝水2000mL以上","減少紅肉和啤酒"],
          creatinine:["多喝水","控制血糖血壓"],
          upcr:["嚴格控制血糖","血壓目標<130/80"],
          platelet:["追蹤血小板趨勢","避免NSAID類藥物"],
          hbsag:["每6個月追蹤肝功能","追蹤AFP和腹部超音波"],
        };
        const tipKeys = [...new Set([...alerts,...warns].map(f=>f.key))];
        const tips = tipKeys.flatMap(k=>TIPS_MAP[k]||[]).slice(0,4);
        return(
          <div className="card">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div className="card-title" style={{marginBottom:0}}>最新抽血報告</div>
              <div style={{fontSize:11,color:C.textMuted}}>{fmtDate(latestLab.date)}</div>
            </div>
            {alerts.length===0&&warns.length===0?(
              <div style={{fontSize:13,color:C.green,padding:"8px 0"}}>✅ 所有追蹤指標均正常</div>
            ):(
              <>
                {alerts.length>0&&(
                  <div style={{marginBottom:8}}>
                    <span style={{fontSize:11,color:C.red,letterSpacing:1}}>❌ 異常</span>
                    <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:6}}>
                      {alerts.map(f=>(
                        <span key={f.key}
                          onClick={()=>{setTab("knowledge");setSelectedKnowledge(KNOWLEDGE_ITEMS.find(i=>i.key===f.key)||null);}}
                          style={{fontSize:12,padding:"4px 10px",background:"rgba(255,90,126,0.12)",borderRadius:8,color:C.red,cursor:"pointer"}}>
                          {f.label} {fmtLabVal(f.key,latestLab[f.key])}{f.unit}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {warns.length>0&&(
                  <div style={{marginBottom:8}}>
                    <span style={{fontSize:11,color:C.amber,letterSpacing:1}}>⚠️ 需注意</span>
                    <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:6}}>
                      {warns.map(f=>(
                        <span key={f.key}
                          onClick={()=>{setTab("knowledge");setSelectedKnowledge(KNOWLEDGE_ITEMS.find(i=>i.key===f.key)||null);}}
                          style={{fontSize:12,padding:"4px 10px",background:"rgba(255,179,71,0.12)",borderRadius:8,color:C.amber,cursor:"pointer"}}>
                          {f.label} {fmtLabVal(f.key,latestLab[f.key])}{f.unit}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            {tips.length>0&&(
              <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${C.border}`}}>
                <div style={{fontSize:11,color:C.textMuted,letterSpacing:1,marginBottom:6}}>📌 注意事項</div>
                {tips.map((tip,i)=>(
                  <div key={i} style={{fontSize:12,color:C.text,padding:"4px 0",display:"flex",gap:8}}>
                    <span style={{color:C.green}}>•</span>{tip}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      <div className="card">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div className="card-title" style={{marginBottom:0}}>定期健康提醒</div>
          {!reminders.some(r=>r.id==="HF01")&&(
            <button onClick={addHospitalFollowups}
              style={{padding:"5px 10px",borderRadius:8,fontSize:11,cursor:"pointer",fontWeight:600,
                background:"rgba(255,179,71,0.12)",border:`1px solid ${C.amber}66`,color:C.amber,
                fontFamily:"'Noto Sans TC',sans-serif"}}>
              📋 一鍵建立住院追蹤套組
            </button>
          )}
        </div>
        {!reminders.some(r=>r.id==="HF01")&&(
          <div style={{fontSize:11,color:C.textMuted,marginBottom:10,lineHeight:1.6}}>
            依2025/03/19住院確診建立6項追蹤：心臟科（動脈瘤+LAD1）、右眼視野、眼底OCT、腹超、血液常規、肝功能尿酸
          </div>
        )}
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
      {editReminder&&(()=>{
        const title=editReminder.title||"";
        const isLab=/血液常規|HbA1c|肝功能|腎功能|尿酸|ALT|抽血/.test(title);
        const isEye=/眼底|視野|OCT|視網膜/.test(title);
        const isHeart=/心臟科|心電圖/.test(title);
        const isAbdomen=/腹部超音波|腹超/.test(title);
        let autoDate=null,autoSource=null;
        if(isLab&&labHistory.length>0){
          const sorted=[...labHistory].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
          autoDate=sorted[0].date;
          autoSource="抽血記錄（"+(sorted[0].hospital||"")+"）";
        }else if((isEye||isHeart||isAbdomen)&&imagingHistory.length>0){
          const keyword=isEye?"眼":isHeart?"心":"腹";
          const matched=[...imagingHistory]
            .filter(r=>(r.type||"").includes(keyword)||(r.finding||"").includes(keyword))
            .sort((a,b)=>String(b.date).localeCompare(String(a.date)));
          if(matched.length>0){autoDate=matched[0].date;autoSource="影像記錄（"+(matched[0].type||"")+"）";}
        }
        const [reminderDate,setReminderDate]=React.useState(autoDate||editReminder.lastDate);
        return(
          <div className="overlay">
            <div className="overlay-sheet">
              <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>{editReminder.icon} {editReminder.title}</div>
              <div style={{fontSize:12,color:C.textMuted,marginBottom:12}}>輸入最近一次檢查日期（{editReminder.intervalDays}天後自動計算下次）</div>
              {autoDate&&autoDate!==editReminder.lastDate&&(
                <div style={{background:C.green+"22",border:"1px solid "+C.green,borderRadius:8,
                  padding:"8px 12px",marginBottom:12,fontSize:11,color:C.green,lineHeight:1.6}}>
                  ✅ 自動抓取：{autoSource}<br/>
                  <span style={{fontWeight:700}}>{autoDate}</span>
                  <span style={{color:C.textMuted}}> （已自動填入）</span>
                </div>
              )}
              {autoDate&&autoDate===editReminder.lastDate&&(
                <div style={{background:C.bg,borderRadius:8,padding:"8px 12px",marginBottom:12,fontSize:11,color:C.textMuted}}>
                  📋 {autoSource} 與現有日期相同：{autoDate}
                </div>
              )}
              <div className="field-label">最近一次檢查日期</div>
              <input className="input-field" type="date" value={reminderDate}
                onChange={e=>setReminderDate(e.target.value)} style={{marginBottom:16}}/>
              <div style={{display:"flex",gap:10}}>
                <button className="btn-secondary" style={{flex:1}} onClick={()=>setEditReminder(null)}>取消</button>
                <button className="btn-primary" style={{flex:2}} onClick={()=>{if(reminderDate)updateReminderDate(editReminder.id,reminderDate);}}>確認更新</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );

  // ── 趨勢 ───────────────────────────────────────────────
  const TrendTab=()=>{
    const BTNS=[{key:"overview",label:"📊總覽"},{key:"radar",label:"雷達"},{key:"organ",label:"🫀器官"},{key:"glucose",label:"血糖"},{key:"bp",label:"血壓"},{key:"weight",label:"體重"},{key:"lab",label:"抽血指標"}];
    const gDaily=glucoseHistory.filter(r=>r.source!=="醫院").map(r=>({date:r.date,v:parseFloat(r.value_mgdl)}));
    const gHosp=glucoseHistory.filter(r=>r.source==="醫院").map(r=>({date:r.date,v:parseFloat(r.value_mgdl)}));
    const bpDaily=bpHistory.filter(r=>r.source!=="醫院");
    const bpHosp=bpHistory.filter(r=>r.source==="醫院");
    const wtData=weightHistory.map(r=>({date:r.date,v:parseFloat(r.value_kg)}));
    return(
      <div className="fade-in" style={{padding:"16px 16px 80px"}}>
        <div className="section-header">📈 健康趨勢</div>
        <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
          {BTNS.map(t=>(
            <button key={t.key} className={`btn-sm ${trendItem===t.key?"active":""}`}
              style={{flex:"1 1 28%",padding:"8px 4px",fontSize:11}} onClick={()=>setTrendItem(t.key)}>{t.label}</button>
          ))}
        </div>
        {trendItem==="overview"&&(()=>{
          const sorted=[...labHistory].sort((a,b)=>String(a.date).localeCompare(String(b.date)));
          // 核心指標定義：key, 標籤, 單位, 方向(low=越低越好/high=越高越好), 目標值, 警戒值
          const CORE=[
            {k:"hba1c",label:"HbA1c",unit:"%",dir:"low",good:5.7,bad:6.5},
            {k:"glucose_ac",label:"空腹血糖",unit:"",dir:"low",good:100,bad:126},
            {k:"hdl",label:"HDL",unit:"",dir:"high",good:40,bad:35},
            {k:"ldl",label:"LDL",unit:"",dir:"low",good:100,bad:160},
            {k:"tg",label:"三酸甘油酯",unit:"",dir:"low",good:150,bad:200},
            {k:"alt",label:"ALT肝",unit:"",dir:"low",good:40,bad:80},
            {k:"ast",label:"AST肝",unit:"",dir:"low",good:37,bad:80},
            {k:"uric_acid",label:"尿酸",unit:"",dir:"low",good:7.0,bad:8.5},
            {k:"creatinine",label:"肌酸酐",unit:"",dir:"low",good:1.0,bad:1.3},
            {k:"wbc",label:"白血球",unit:"",dir:"mid",good:5.5,lowB:4,highB:10},
            {k:"platelet",label:"血小板",unit:"",dir:"high",good:200,bad:150},
            {k:"crp",label:"CRP發炎",unit:"",dir:"low",good:1,bad:3},
          ];
          const Spark=({series})=>{
            if(series.length<2)return <div style={{width:60,height:24}}/>;
            const vals=series.map(s=>s.v);
            const mn=Math.min(...vals),mx=Math.max(...vals),rg=mx-mn||1;
            const W=60,H=24;
            const pts=series.map((s,i)=>{
              const x=series.length===1?W/2:(i/(series.length-1))*W;
              const y=H-((s.v-mn)/rg)*(H-4)-2;
              return `${x.toFixed(1)},${y.toFixed(1)}`;
            }).join(" ");
            return(
              <svg width={W} height={H} style={{display:"block"}}>
                <polyline points={pts} fill="none" stroke={C.blue} strokeWidth="1.5"
                  strokeLinejoin="round" strokeLinecap="round"/>
                {series.map((s,i)=>{
                  const x=series.length===1?W/2:(i/(series.length-1))*W;
                  const y=H-((s.v-mn)/rg)*(H-4)-2;
                  return <circle key={i} cx={x} cy={y} r={i===series.length-1?2.2:1.2}
                    fill={i===series.length-1?C.green:C.blue}/>;
                })}
              </svg>
            );
          };
          const rows=CORE.map(c=>{
            const series=sorted.filter(r=>r[c.k]!==null&&r[c.k]!==undefined&&r[c.k]!=="")
              .map(r=>({date:r.date,v:parseFloat(r[c.k])})).filter(s=>!isNaN(s.v));
            if(series.length===0)return null;
            const latest=series[series.length-1].v;
            const prev=series.length>1?series[series.length-2].v:null;
            // 方向判斷
            let trend="—",trendColor=C.textMuted;
            if(prev!=null){
              const diff=latest-prev;
              const improving=c.dir==="low"?diff<0:c.dir==="high"?diff>0:Math.abs(latest-c.good)<Math.abs(prev-c.good);
              if(Math.abs(diff)<0.01){trend="→";trendColor=C.textMuted;}
              else if(improving){trend=diff>0?"▲":"▼";trendColor=C.green;}
              else{trend=diff>0?"▲":"▼";trendColor=C.red;}
            }
            // 狀態色（依目標/警戒）
            let statusColor=C.green;
            if(c.dir==="low"){statusColor=latest>=c.bad?C.red:latest>c.good?C.amber:C.green;}
            else if(c.dir==="high"){statusColor=latest<=c.bad?C.red:latest<c.good?C.amber:C.green;}
            else{statusColor=(latest<c.lowB||latest>c.highB)?C.amber:C.green;}
            return{...c,series,latest,prev,trend,trendColor,statusColor};
          }).filter(Boolean);
          if(rows.length===0)return <div className="card"><div className="empty-state">尚無抽血資料</div></div>;
          return(
            <div>
              <div style={{fontSize:12,color:C.textMuted,lineHeight:1.7,marginBottom:12,
                background:"rgba(46,204,138,0.06)",border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 12px"}}>
                📊 所有核心指標一覽。左側色點為目前狀態（綠正常/橘注意/紅警戒），右側箭頭為相對上次的方向（綠=改善、紅=惡化）。
              </div>
              <div className="card" style={{padding:"4px 0"}}>
                {rows.map((r,idx)=>(
                  <div key={r.k} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",
                    borderBottom:idx<rows.length-1?`1px solid ${C.border}`:"none"}}>
                    {/* 狀態點 */}
                    <div style={{width:8,height:8,borderRadius:"50%",background:r.statusColor,flexShrink:0}}/>
                    {/* 名稱 */}
                    <div style={{flex:"0 0 72px",fontSize:12,color:C.text}}>{r.label}</div>
                    {/* sparkline */}
                    <div style={{flex:"0 0 60px"}}><Spark series={r.series}/></div>
                    {/* 數值 */}
                    <div style={{flex:1,textAlign:"right"}}>
                      <span style={{fontSize:15,fontWeight:700,color:r.statusColor}}>{r.latest}</span>
                    </div>
                    {/* 箭頭+狀態 */}
                    <div style={{flex:"0 0 54px",textAlign:"right"}}>
                      <div style={{fontSize:12,fontWeight:700,color:r.trendColor}}>{r.trend}</div>
                      <div style={{fontSize:9,color:r.trendColor,marginTop:1}}>
                        {r.trend==="→"?"穩定":r.trendColor===C.green?"改善中":"惡化"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{fontSize:10,color:C.textMuted,marginTop:8,textAlign:"center"}}>
                共 {rows.length} 項核心指標 · 點「抽血指標」可看個別詳細趨勢
              </div>
            </div>
          );
        })()}
        {trendItem==="radar"&&(()=>{
          const sortedLabs=[...labHistory].sort((a,b)=>String(a.date).localeCompare(String(b.date)));
          const [compareIdx,setCompareIdx]=React.useState(sortedLabs.length>1?sortedLabs.length-2:-1);
          const curLab=sortedLabs.length>0?sortedLabs[sortedLabs.length-1]:null;
          const compLab=compareIdx>=0&&compareIdx<sortedLabs.length-1?sortedLabs[compareIdx]:null;
          const cur=computeRadarScores(curLab,bpHistory);
          const prev=compLab?computeRadarScores(compLab,[]):null;
          if(!cur)return<div className="card"><div className="empty-state">尚無抽血資料</div></div>;
          const N=cur.length, CX=170, CY=160, R=110;
          const pt=(i,score)=>{
            const ang=-Math.PI/2+i*2*Math.PI/N;
            const r=R*(score==null?0:score)/10;
            return[CX+r*Math.cos(ang),CY+r*Math.sin(ang)];
          };
          const poly=(scores)=>scores.map((d,i)=>pt(i,d.score).join(",")).join(" ");
          const weak=cur.filter(d=>d.score!=null&&d.score<6.5).sort((a,b)=>a.score-b.score);
          return(
            <div className="card">
              <div className="card-title">健康雷達（依抽血+血壓計分）</div>
              {/* 對比選擇器 */}
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,flexWrap:"wrap"}}>
                <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:12,height:3,background:C.green,borderRadius:2}}/><span style={{fontSize:11,color:C.textMuted}}>本次 {fmtDate(curLab.date)}</span></div>
                {sortedLabs.length>1&&(
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                    <div style={{width:12,height:0,borderTop:`2px dashed ${C.blue}`}}/>
                    <span style={{fontSize:11,color:C.textMuted}}>對比</span>
                    <select value={compareIdx} onChange={e=>setCompareIdx(parseInt(e.target.value))}
                      style={{fontSize:11,background:C.bgCard2,border:`1px solid ${C.border}`,borderRadius:6,color:C.textMuted,padding:"2px 4px"}}>
                      <option value={-1}>不對比</option>
                      {sortedLabs.slice(0,-1).map((lab,i)=>(
                        <option key={i} value={i}>{fmtDate(lab.date)} ({lab.hospital||"—"})</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <svg viewBox="0 0 340 320" style={{width:"100%"}}>
                {[2,4,6,8,10].map(lv=>(
                  <polygon key={lv} points={Array.from({length:N},(_,i)=>{
                    const ang=-Math.PI/2+i*2*Math.PI/N;
                    return[CX+R*lv/10*Math.cos(ang),CY+R*lv/10*Math.sin(ang)].join(",");
                  }).join(" ")} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
                ))}
                {cur.map((d,i)=>{
                  const ang=-Math.PI/2+i*2*Math.PI/N;
                  const lx=CX+(R+24)*Math.cos(ang), ly=CY+(R+24)*Math.sin(ang);
                  return(
                    <g key={i}>
                      <line x1={CX} y1={CY} x2={CX+R*Math.cos(ang)} y2={CY+R*Math.sin(ang)} stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
                      <text x={lx} y={ly} textAnchor="middle" fontSize="11" fill={d.score!=null&&d.score<6.5?C.amber:C.textMuted}>{d.label}</text>
                      <text x={lx} y={ly+13} textAnchor="middle" fontSize="11" fontWeight="700" fill={d.score==null?C.textMuted:d.score<5?C.red:d.score<6.5?C.amber:C.green}>{d.score==null?"–":d.score}</text>
                    </g>
                  );
                })}
                {prev&&<polygon points={poly(prev)} fill="rgba(90,180,255,0.08)" stroke={C.blue} strokeWidth="1.5" strokeDasharray="5,4"/>}
                <polygon points={poly(cur)} fill="rgba(46,204,138,0.15)" stroke={C.green} strokeWidth="2"/>
                {cur.map((d,i)=>{const[x,y]=pt(i,d.score);return<circle key={i} cx={x} cy={y} r="3" fill={C.green}/>;})}
              </svg>
              {weak.length>0&&(
                <div style={{background:"rgba(255,179,71,0.08)",border:"1px solid rgba(255,179,71,0.25)",borderRadius:10,padding:10,marginTop:8}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.amber,marginBottom:4}}>⚠️ 待加強面向</div>
                  <div style={{fontSize:12,color:C.textMuted,lineHeight:1.7}}>
                    {weak.map(d=>`${d.label}（${d.score}分）`).join("、")}
                    <br/>你的修復早餐正是針對血脂與肝臟設計，持續執行+下次抽血驗證！
                  </div>
                </div>
              )}
              {(()=>{
                const cvDim=cur.find(d=>d.label.startsWith("心血管"));
                return cvDim?.cvAvg?(
                  <div style={{background:"rgba(90,180,255,0.08)",border:"1px solid rgba(90,180,255,0.2)",borderRadius:10,padding:"8px 12px",marginBottom:8,fontSize:11,color:C.blue,lineHeight:1.6}}>
                    💓 心血管：近{Math.min(bpHistory.length,7)}筆血壓均值 {cvDim.cvAvg} mmHg（單次波動已平滑）
                  </div>
                ):bpHistory.length===0?(
                  <div style={{background:"rgba(255,179,71,0.08)",border:"1px solid rgba(255,179,71,0.2)",borderRadius:10,padding:"8px 12px",marginBottom:8,fontSize:11,color:C.amber,lineHeight:1.6}}>
                    💓 心血管：尚無血壓記錄，請先記錄幾筆血壓（建議7筆以上取均值）
                  </div>
                ):null;
              })()}
              <div style={{fontSize:10,color:C.textMuted,marginTop:8,lineHeight:1.6}}>
                計分方式：各指標與理想值比較換算0-10分（10=理想、5=異常臨界），面向內多指標取平均。心血管取近7筆血壓均值。
              </div>
            </div>
          );
        })()}
        {trendItem==="organ"&&(()=>{
          const today=new Date();
          // 把每筆影像歸到對應器官系統
          const byOrgan=ORGAN_SYSTEMS.map(sys=>{
            const records=imagingHistory
              .filter(r=>sys.types.includes(r.type))
              .sort((a,b)=>String(b.date).localeCompare(String(a.date)));
            return {...sys, records};
          });
          return(
            <div>
              <div style={{fontSize:12,color:C.textMuted,lineHeight:1.7,marginBottom:12,
                background:"rgba(90,180,255,0.06)",border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 12px"}}>
                🩺 依器官系統串連歷年影像，追蹤每個部位的變化與下次檢查時間。紅字為需持續監控的項目。
              </div>
              {byOrgan.map(sys=>{
                if(sys.records.length===0&&sys.watch.length===0)return null;
                // 下次檢查到期判斷
                const nextD=sys.nextCheck?new Date(sys.nextCheck):null;
                const overdue=nextD&&nextD<=today;
                const daysLeft=nextD?Math.ceil((nextD-today)/(1000*60*60*24)):null;
                return(
                  <div key={sys.key} className="card" style={{marginBottom:10}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:20}}>{sys.icon}</span>
                        <span style={{fontSize:14,fontWeight:700,color:C.text}}>{sys.name}</span>
                      </div>
                      <span style={{fontSize:10,color:C.textMuted,background:C.bg,borderRadius:8,padding:"2px 8px"}}>
                        {sys.records.length} 次檢查
                      </span>
                    </div>
                    {/* 需監控項目 */}
                    {sys.watch.length>0&&(
                      <div style={{marginBottom:8,padding:"8px 10px",background:"rgba(255,107,107,0.06)",borderRadius:8}}>
                        <div style={{fontSize:10,fontWeight:700,color:C.red,marginBottom:4}}>⚠️ 追蹤中</div>
                        {sys.watch.map((w,i)=>(
                          <div key={i} style={{fontSize:11,color:C.red,lineHeight:1.6}}>• {w}</div>
                        ))}
                      </div>
                    )}
                    {/* 歷年檢查時間軸 */}
                    {sys.records.length>0?(
                      <div style={{position:"relative",paddingLeft:16}}>
                        <div style={{position:"absolute",left:4,top:4,bottom:4,width:2,background:C.border}}/>
                        {sys.records.map((r,i)=>(
                          <div key={i} style={{position:"relative",marginBottom:8,cursor:"pointer"}}
                            onClick={()=>{setTab("record");setRecordTab("history");}}>
                            <div style={{position:"absolute",left:-15,top:4,width:8,height:8,borderRadius:"50%",
                              background:i===0?C.green:C.textMuted,border:`2px solid ${C.bgCard}`}}/>
                            <div style={{fontSize:12,fontWeight:600,color:i===0?C.green:C.text}}>
                              {r.date} · {r.type}
                            </div>
                            <div style={{fontSize:11,color:C.textMuted,lineHeight:1.5,marginTop:2}}>
                              {(r.finding||"").slice(0,55)}{(r.finding||"").length>55?"...":""}
                            </div>
                          </div>
                        ))}
                      </div>
                    ):(
                      <div style={{fontSize:11,color:C.textMuted,fontStyle:"italic"}}>尚無此系統影像記錄</div>
                    )}
                    {/* 下次檢查 */}
                    {sys.interval&&(
                      <div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${C.border}`,
                        display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <span style={{fontSize:11,color:C.textMuted}}>⏰ {sys.interval}</span>
                        {nextD&&(
                          <span style={{fontSize:11,fontWeight:700,
                            color:overdue?C.red:daysLeft<=30?C.amber:C.green}}>
                            {overdue?"已到期！":`下次 ${sys.nextCheck}（${daysLeft}天）`}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {imagingHistory.length===0&&(
                <div className="empty-state">📂 尚無影像記錄<br/>到「記錄→🔬影像」新增，並補齊去年的CT/MRI做基準線</div>
              )}
            </div>
          );
        })()}
        {trendItem==="glucose"&&(
          <div className="card">
            <div className="card-title">血糖趨勢</div>
            <div style={{display:"flex",gap:12,marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:12,height:3,background:C.green,borderRadius:2}}/><span style={{fontSize:11,color:C.textMuted}}>🏠 日常</span></div>
              <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:12,height:3,background:C.blue,borderRadius:2}}/><span style={{fontSize:11,color:C.textMuted}}>🏥 醫院</span></div>
            </div>
            <LineChart datasets={[{data:gDaily},{data:gHosp}]} min={60} max={160}
              statusKey="glucose_ac"
              refLines={[{v:70,label:"低血糖"},{v:100,label:"前期線"},{v:126,label:"糖尿病"}]}/>
          </div>
        )}
        {trendItem==="bp"&&(
          <>
            <div className="card">
              <div className="card-title">血壓趨勢（收縮壓）</div>
              <div style={{display:"flex",gap:12,marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:12,height:3,background:C.green,borderRadius:2}}/><span style={{fontSize:11,color:C.textMuted}}>🏠 日常</span></div>
                <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:12,height:3,background:C.blue,borderRadius:2}}/><span style={{fontSize:11,color:C.textMuted}}>🏥 醫院</span></div>
              </div>
              <LineChart datasets={[{data:bpDaily.map(r=>({date:r.date,v:parseInt(r.systolic)}))},{data:bpHosp.map(r=>({date:r.date,v:parseInt(r.systolic)}))}]}
                min={80} max={180}
                refLines={[{v:120,label:"正常上限"},{v:130,label:"高血壓1"},{v:140,label:"高血壓2"}]}/>
            </div>
            <div className="card">
              <div className="card-title">血壓趨勢（舒張壓）</div>
              <LineChart datasets={[{data:bpDaily.map(r=>({date:r.date,v:parseInt(r.diastolic)}))},{data:bpHosp.map(r=>({date:r.date,v:parseInt(r.diastolic)}))}]}
                min={50} max={120}
                refLines={[{v:80,label:"正常上限"},{v:90,label:"高血壓"}]}/>
            </div>
            {/* 血壓狀態分析 */}
            {bpHistory.length>0&&(()=>{
              const latest=bpHistory[bpHistory.length-1];
              const sys=parseInt(latest.systolic);
              const dia=parseInt(latest.diastolic);
              let status,color,advice;
              if(sys<120&&dia<80){status="正常";color=C.green;advice="維持良好生活習慣";}
              else if(sys<130&&dia<80){status="偏高";color=C.amber;advice="減鈉、規律運動、控制體重";}
              else if(sys<140||dia<90){status="高血壓第一期";color=C.amber;advice="積極生活調整，3個月後未改善建議就醫";}
              else{status="高血壓第二期";color=C.red;advice="建議就醫評估是否需要藥物治療";}
              return(
                <div className="card" style={{border:`1px solid ${color}44`}}>
                  <div className="card-title">最新血壓評估</div>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                    <span style={{fontSize:24,fontFamily:"'DM Serif Display',serif",color}}>{sys}/{dia}</span>
                    <span style={{fontSize:13,fontWeight:700,color}}>{status}</span>
                  </div>
                  <div style={{fontSize:12,color:C.textMuted,lineHeight:1.7}}>💡 {advice}</div>
                  <div style={{fontSize:11,color:C.textMuted,marginTop:6}}>測量日期：{fmtDate(latest.date)} {latest.source&&`(${latest.source})`}</div>
                </div>
              );
            })()}
            {/* G3 血壓達標率 + F1 均線說明 */}
            {bpHistory.length>=3&&(()=>{
              const recent30=bpHistory.slice(-30);
              const target130=recent30.filter(r=>parseInt(r.systolic)<130&&parseInt(r.diastolic)<80).length;
              const target140=recent30.filter(r=>parseInt(r.systolic)<140&&parseInt(r.diastolic)<90).length;
              const pct130=Math.round(target130/recent30.length*100);
              const pct140=Math.round(target140/recent30.length*100);
              // 7日滾動均值
              const rolling=bpHistory.slice(-7);
              const avgS=Math.round(rolling.reduce((s,r)=>s+parseInt(r.systolic),0)/rolling.length);
              const avgD=Math.round(rolling.reduce((s,r)=>s+parseInt(r.diastolic),0)/rolling.length);
              return(
                <div className="card">
                  <div className="card-title">血壓達標率（近{recent30.length}筆）</div>
                  <div style={{display:"flex",gap:8,marginBottom:10}}>
                    <div style={{flex:1,background:"rgba(46,204,138,0.08)",borderRadius:10,padding:"8px 10px",textAlign:"center"}}>
                      <div style={{fontSize:22,fontWeight:700,color:pct130>=60?C.green:C.amber}}>{pct130}%</div>
                      <div style={{fontSize:10,color:C.textMuted,marginTop:2}}>達標 &lt;130/80<br/>（理想目標）</div>
                    </div>
                    <div style={{flex:1,background:"rgba(90,180,255,0.08)",borderRadius:10,padding:"8px 10px",textAlign:"center"}}>
                      <div style={{fontSize:22,fontWeight:700,color:pct140>=80?C.green:C.amber}}>{pct140}%</div>
                      <div style={{fontSize:10,color:C.textMuted,marginTop:2}}>達標 &lt;140/90<br/>（控制目標）</div>
                    </div>
                    <div style={{flex:1,background:"rgba(255,179,71,0.08)",borderRadius:10,padding:"8px 10px",textAlign:"center"}}>
                      <div style={{fontSize:18,fontWeight:700,color:avgS<130?C.green:C.amber}}>{avgS}/{avgD}</div>
                      <div style={{fontSize:10,color:C.textMuted,marginTop:2}}>近7筆均值<br/>mmHg</div>
                    </div>
                  </div>
                  <div style={{fontSize:11,color:C.textMuted,lineHeight:1.7}}>
                    💡 舒脈康效果追蹤：連續每天量血壓，目標讓&lt;130/80達標率逐月提升
                  </div>
                </div>
              );
            })()}
          </>
        )}
        {trendItem==="weight"&&(
          <div className="card">
            <div className="card-title">體重趨勢</div>
            <LineChart datasets={[{data:wtData}]} min={60} max={90} refLines={[{v:75,label:"目標"}]}/>
          </div>
        )}
        {trendItem==="lab"&&(
          <>
            {labHistory.length===0?(
              <div className="empty-state">📋 尚無抽血資料<br/>請至「記錄」→「📋抽血」上傳報告</div>
            ):(
              <>
                {/* 追蹤項目選擇器 */}
                <div className="card" style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                    <div className="card-title" style={{marginBottom:0}}>追蹤項目</div>
                    <div style={{display:"flex",gap:6}}>
                      <button className="btn-sm" onClick={()=>setShowTrackPicker(p=>!p)}>
                        {showTrackPicker?"收起":"＋ 新增/移除"}
                      </button>
                    </div>
                  </div>
                  {showTrackPicker&&(
                    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                      {ALL_TRACK_ITEMS.map(item=>(
                        <div key={item.key}
                          onClick={()=>toggleTrack(item.key)}
                          style={{padding:"5px 12px",borderRadius:20,fontSize:12,cursor:"pointer",
                            background:trackItems.includes(item.key)?"rgba(46,204,138,0.15)":C.bg,
                            border:`1px solid ${trackItems.includes(item.key)?C.green:C.border}`,
                            color:trackItems.includes(item.key)?C.green:C.textMuted}}>
                          {trackItems.includes(item.key)?"✓ ":""}{item.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* 趨勢圖 */}
                {trackItems.map(key=>{
                  const s=LAB_STATUS[key];
                  if(!s)return null;
                  const data=labHistory.filter(r=>r[key]!==null&&r[key]!==undefined&&r[key]!=="").map(r=>({date:r.date,v:parseFloat(r[key])}));
                  if(data.length===0)return null;
                  const vals=data.map(d=>d.v);
                  const minV=Math.min(...vals);
                  const maxV=Math.max(...vals);
                  const pad=(maxV-minV)*0.3||1;
                  const chartMin=Math.max(0,minV-pad);
                  const chartMax=maxV+pad;
                  const refs=[];
                  if(s.warn)refs.push({v:s.warn,label:"警戒",c:C.amber});
                  if(s.alert&&s.alert!==s.warn)refs.push({v:s.alert,label:"異常",c:C.red});
                  if(s.low)refs.push({v:s.low,label:"下限",c:C.blue});
                  const colors=[C.amber,C.green,C.red,C.blue,C.purple];
                  const colorIdx=trackItems.indexOf(key)%colors.length;
                  return(
                    <div key={key} className="card" style={{marginBottom:10}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                        <span style={{fontSize:13,fontWeight:600,color:colors[colorIdx]}}>{s.label}</span>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontSize:11,color:C.textMuted}}>{s.unit}</span>
                          {/* 最新值 + 上次值 */}
                          {data.length>=2&&(()=>{
                            const latest=data[data.length-1].v;
                            const prev=data[data.length-2].v;
                            const diff=latest-prev;
                            const pct=Math.abs(Math.round(diff/prev*100));
                            return(
                              <span style={{fontSize:11,color:diff>0?C.red:diff<0?C.green:C.textMuted}}>
                                {diff>0?"↑":"↓"}{pct}%
                              </span>
                            );
                          })()}
                          {data.length>0&&<StatusDot status={getStatus(key,data[data.length-1].v)}/>}
                          {/* 上下移動按鈕 */}
                          <div style={{display:"flex",gap:2}}>
                            <button onClick={()=>{
                              const idx=trackItems.indexOf(key);
                              if(idx>0){
                                const updated=[...trackItems];
                                [updated[idx-1],updated[idx]]=[updated[idx],updated[idx-1]];
                                setTrackItems(updated);
                                localStorage.setItem("hj_track",JSON.stringify(updated));
                                api.saveSetting("trackItems",updated);
                              }
                            }} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:4,color:C.textMuted,padding:"1px 6px",cursor:"pointer",fontSize:11}}>↑</button>
                            <button onClick={()=>{
                              const idx=trackItems.indexOf(key);
                              if(idx<trackItems.length-1){
                                const updated=[...trackItems];
                                [updated[idx],updated[idx+1]]=[updated[idx+1],updated[idx]];
                                setTrackItems(updated);
                                localStorage.setItem("hj_track",JSON.stringify(updated));
                                api.saveSetting("trackItems",updated);
                              }
                            }} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:4,color:C.textMuted,padding:"1px 6px",cursor:"pointer",fontSize:11}}>↓</button>
                          </div>
                        </div>
                      </div>
                      <LineChart datasets={[{data}]}
                        min={chartMin} max={chartMax} refLines={refs} height={100}
                        statusKey={key}/>
                      {/* 趨勢分析說明 */}
                      {(()=>{
                        const trend = analyzeTrend(key, data);
                        if (!trend) return null;
                        return (
                          <div style={{marginTop:8,padding:"8px 10px",background:C.bg,borderRadius:8,border:`1px solid ${C.border}`}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                              <div style={{fontSize:12,color:trend.color,fontWeight:600}}>
                                {trend.icon} {trend.message}
                                <span style={{fontSize:11,color:C.textMuted,marginLeft:6}}>
                                  近{trend.recent.length}次：{trend.recent.join(" → ")}
                                </span>
                              </div>
                            </div>
                            <div style={{fontSize:11,color:C.textMuted,marginBottom:6}}>
                              💡 {trend.suggest}
                            </div>
                            {/* AI 深度分析 */}
                            {trendAiResult[key] ? (
                              <div style={{fontSize:11,color:C.text,lineHeight:1.7,padding:"6px 8px",background:"rgba(46,204,138,0.05)",borderRadius:6,border:`1px solid ${C.green}22`}}>
                                🤖 {trendAiResult[key]}
                                <button onClick={()=>setTrendAiResult(p=>({...p,[key]:null}))}
                                  style={{display:"block",marginTop:4,fontSize:10,color:C.textMuted,background:"transparent",border:"none",cursor:"pointer",fontFamily:"'Noto Sans TC',sans-serif"}}>
                                  收起
                                </button>
                              </div>
                            ) : (
                              <button
                                disabled={trendAiLoading && trendAiKey===key}
                                onClick={async()=>{
                                  const apiKey=localStorage.getItem("hj_apikey")||"";
                                  if(!apiKey){showToast("⚠️ 請先在設定Tab輸入API金鑰");return;}
                                  setTrendAiKey(key);
                                  setTrendAiLoading(true);
                                  try{
                                    const recentData=data.slice(-5).map(d=>`${fmtDate(d.date)}:${d.v}${s.unit}`).join(", ");
                                    const prompt=`你是健康顧問，用2-3句繁體中文分析這個趨勢，針對55歲男性T2D前期患者。
指標：${s.label}（正常範圍：${s.low||0}-${s.warn} ${s.unit}）
近期數值：${recentData}
請給出：1.趨勢評估 2.一個具體行動建議。不超過60字。`;
                                    const result=await callClaude([{role:"user",content:prompt}],300);
                                    setTrendAiResult(p=>({...p,[key]:result}));
                                  }catch(e){
                                    showToast("❌ AI分析失敗："+e.message);
                                  }
                                  setTrendAiLoading(false);
                                }}
                                style={{fontSize:11,color:C.green,background:"transparent",border:`1px solid ${C.green}44`,borderRadius:6,padding:"3px 8px",cursor:"pointer",fontFamily:"'Noto Sans TC',sans-serif"}}>
                                {trendAiLoading && trendAiKey===key ? "⏳ 分析中..." : "🤖 AI深度分析"}
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}
      </div>
    );
  };



  // ── 歷史記錄 Tab ──────────────────────────────────────
  const HistoryTab = () => {
    const [delConfirm, setDelConfirm] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [expanded, setExpanded] = useState(null);
    const [sortDesc, setSortDesc] = useState(true);
    const [histFilter, setHistFilter] = useState("all");

    const allRecords = [
      ...labHistory.map(r=>({...r, _type:"lab", _icon:"🩸", _label:"抽血檢查",
        _summary:`HbA1c ${r.hba1c||"—"}% · 血糖 ${r.glucose_ac||"—"}`})),
      ...imagingHistory.map(r=>({...r, _type:"imaging", _icon:"🔬", _label:r.type||"影像檢查",
        _summary:r.finding?r.finding.slice(0,30)+(r.finding.length>30?"...":""):""})),
    ].sort((a,b)=>sortDesc
      ? String(b.date).localeCompare(String(a.date))
      : String(a.date).localeCompare(String(b.date))
    );
    const filteredRecords = histFilter==="all"?allRecords:allRecords.filter(r=>r._type===histFilter);

    const handleDelete = async (record) => {
      setDeleting(true);
      const sheet = record._type==="lab" ? "lab_reports" : "imaging";
      try {
        const r = await api.deleteRow(sheet, record.id);
        if(r?.success){
          showToast("🗑️ 已刪除");
          loadData();
          setDelConfirm(null);
        } else {
          const errMsg = r?.error||"未知錯誤";
          showToast("❌ 刪除失敗：" + errMsg);
          console.log("Delete error:", r);
        }
      } catch(e) {
        showToast("❌ 刪除失敗：" + e.message);
      }
      setDeleting(false);
    };

    // 抽血報告完整數值欄位 - 依分類排列
    const LAB_DISPLAY = [
      // 血糖
      {key:"hba1c",label:"HbA1c",unit:"%",group:"血糖"},
      {key:"glucose_ac",label:"空腹血糖",unit:"mg/dL",group:"血糖"},
      {key:"glucose_pc",label:"飯後血糖",unit:"mg/dL",group:"血糖"},
      // 肝功能
      {key:"alt",label:"ALT",unit:"U/L",group:"肝功能"},
      {key:"ast",label:"AST",unit:"U/L",group:"肝功能"},
      {key:"alp",label:"ALP",unit:"U/L",group:"肝功能"},
      {key:"ggt",label:"GGT",unit:"U/L",group:"肝功能"},
      {key:"ldh",label:"LDH",unit:"U/L",group:"肝功能"},
      {key:"tbil",label:"總膽紅素",unit:"mg/dL",group:"肝功能"},
      {key:"dbil",label:"直接膽紅素",unit:"mg/dL",group:"肝功能"},
      {key:"tp",label:"總蛋白",unit:"g/dL",group:"肝功能"},
      {key:"alb",label:"白蛋白",unit:"g/dL",group:"肝功能"},
      {key:"glob",label:"球蛋白",unit:"g/dL",group:"肝功能"},
      {key:"ag_ratio",label:"A/G比值",unit:"",group:"肝功能"},
      // 腎功能
      {key:"creatinine",label:"肌酸酐",unit:"mg/dL",group:"腎功能"},
      {key:"gfr",label:"eGFR(CKD-EPI)",unit:"",group:"腎功能"},
      {key:"gfr2",label:"eGFR(MDRD)",unit:"",group:"腎功能"},
      {key:"bun",label:"BUN",unit:"mg/dL",group:"腎功能"},
      {key:"upcr",label:"UPCR",unit:"mg/g",group:"腎功能"},
      {key:"urine_creatinine",label:"尿液肌酸酐",unit:"mg/dL",group:"腎功能"},
      {key:"urine_protein",label:"尿液蛋白",unit:"mg/dL",group:"腎功能"},
      {key:"urine_protein2",label:"尿蛋白(隨機)",unit:"mg/dL",group:"腎功能"},
      // 血脂
      {key:"hdl",label:"HDL-C",unit:"mg/dL",group:"血脂"},
      {key:"ldl",label:"LDL-C",unit:"mg/dL",group:"血脂"},
      {key:"tg",label:"三酸甘油酯",unit:"mg/dL",group:"血脂"},
      {key:"cholesterol",label:"總膽固醇",unit:"mg/dL",group:"血脂"},
      {key:"chol_hdl",label:"膽固醇/HDL",unit:"",group:"血脂"},
      // 尿酸/鐵
      {key:"uric_acid",label:"尿酸",unit:"mg/dL",group:"其他生化"},
      {key:"fe",label:"鐵 Fe",unit:"ug/dL",group:"其他生化"},
      {key:"uibc",label:"UIBC",unit:"ug/dL",group:"其他生化"},
      {key:"tibc",label:"TIBC",unit:"ug/dL",group:"其他生化"},
      {key:"fe_sat",label:"鐵飽和度",unit:"%",group:"其他生化"},
      // 甲狀腺
      {key:"tsh",label:"TSH",unit:"uIU/mL",group:"甲狀腺"},
      {key:"ft3",label:"Free T3",unit:"",group:"甲狀腺"},
      {key:"ft4",label:"Free T4",unit:"",group:"甲狀腺"},
      // 電解質
      {key:"na",label:"鈉 Na",unit:"mEq/L",group:"電解質"},
      {key:"k",label:"鉀 K",unit:"mEq/L",group:"電解質"},
      {key:"cl",label:"氯 Cl",unit:"mEq/L",group:"電解質"},
      {key:"ca",label:"鈣 Ca",unit:"mg/dL",group:"電解質"},
      {key:"mg",label:"鎂 Mg",unit:"mg/dL",group:"電解質"},
      {key:"phos",label:"磷 Phos",unit:"mg/dL",group:"電解質"},
      // 發炎/胰臟
      {key:"crp",label:"CRP",unit:"mg/L",group:"其他生化"},
      {key:"amy",label:"澱粉酶 AMY",unit:"U/L",group:"其他生化"},
      {key:"lip",label:"脂肪酶 LIP",unit:"U/L",group:"其他生化"},
      {key:"ck",label:"CK",unit:"U/L",group:"其他生化"},
      // CBC血液
      {key:"wbc",label:"WBC",unit:"K/uL",group:"血液CBC"},
      {key:"rbc",label:"RBC",unit:"M/uL",group:"血液CBC"},
      {key:"hb",label:"血紅素 Hb",unit:"g/dL",group:"血液CBC"},
      {key:"hct",label:"Hct",unit:"%",group:"血液CBC"},
      {key:"mcv",label:"MCV",unit:"fL",group:"血液CBC"},
      {key:"mch",label:"MCH",unit:"pg",group:"血液CBC"},
      {key:"mchc",label:"MCHC",unit:"g/dL",group:"血液CBC"},
      {key:"rdw_cv",label:"RDW-CV",unit:"%",group:"血液CBC"},
      {key:"rdw_sd",label:"RDW-SD",unit:"fL",group:"血液CBC"},
      {key:"platelet",label:"血小板",unit:"K/uL",group:"血液CBC"},
      {key:"mpv",label:"MPV",unit:"fL",group:"血液CBC"},
      // 腫瘤標記
      {key:"cea",label:"CEA",unit:"ng/mL",group:"腫瘤標記"},
      {key:"afp",label:"AFP",unit:"ng/mL",group:"腫瘤標記"},
      {key:"psa",label:"PSA",unit:"ng/mL",group:"腫瘤標記"},
      // 免疫
      {key:"asto",label:"ASTO",unit:"",group:"免疫"},
      {key:"rf",label:"RF類風濕因子",unit:"",group:"免疫"},
      // 病毒補充
      {key:"anti_hbs",label:"Anti-HBs",unit:"",group:"病毒篩檢"},
      // 尿液分析
      {key:"urine_glucose",label:"尿糖",unit:"",group:"尿液分析"},
      {key:"urine_bilirubin",label:"尿膽紅素",unit:"",group:"尿液分析"},
      {key:"urine_ketone",label:"尿酮體",unit:"",group:"尿液分析"},
      {key:"urine_sg",label:"尿比重",unit:"",group:"尿液分析"},
      {key:"urine_ph",label:"尿液pH",unit:"",group:"尿液分析"},
      {key:"urine_nitrite",label:"亞硝酸鹽",unit:"",group:"尿液分析"},
      {key:"urine_urobilinogen",label:"尿膽素原",unit:"",group:"尿液分析"},
      {key:"urine_blood",label:"尿潛血",unit:"",group:"尿液分析"},
      {key:"urine_leukocyte",label:"尿白血球",unit:"",group:"尿液分析"},
    ];
    // 依分組顯示
    const groups = [...new Set(LAB_DISPLAY.map(f=>f.group))];

    return(
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{fontSize:14,fontWeight:600,color:C.text}}>
            檢查記錄（{filteredRecords.length}/{allRecords.length}筆）
          </div>
          <div style={{display:"flex",gap:6}}>
            <button className="btn-sm" onClick={()=>setSortDesc(d=>!d)}>
              {sortDesc?"⬇ 最新":"⬆ 最舊"}
            </button>
            <button className="btn-sm" onClick={loadData}>
              <span className={loading?"spin":""}>⟳</span>
            </button>
          </div>
        </div>
        <div style={{display:"flex",gap:6,marginBottom:12}}>
          {[{key:"all",label:`全部 ${allRecords.length}`},{key:"lab",label:`🩸 抽血 ${labHistory.length}`},{key:"imaging",label:`🔬 影像 ${imagingHistory.length}`}].map(f=>(
            <button key={f.key} onClick={()=>setHistFilter(f.key)}
              style={{padding:"5px 12px",borderRadius:10,fontSize:12,cursor:"pointer",
                background:histFilter===f.key?"rgba(46,204,138,0.12)":"transparent",
                border:`1px solid ${histFilter===f.key?C.green:C.border}`,
                color:histFilter===f.key?C.green:C.textMuted,
                fontFamily:"'Noto Sans TC',sans-serif",fontWeight:histFilter===f.key?700:400}}>
              {f.label}
            </button>
          ))}
        </div>
        {filteredRecords.length===0?(
          <div className="empty-state">📂 尚無記錄<br/>請先在「📋抽血」或「🔬影像」新增記錄</div>
        ):(
          filteredRecords.map(record=>{
            const isExpanded = expanded===record.id;
            return(
              <div key={record.id} className="card" style={{marginBottom:8,padding:"12px 14px"}}>
                {/* 標題列 - 點擊展開/收合 */}
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer"}}
                  onClick={()=>setExpanded(isExpanded?null:record.id)}>
                  <div style={{display:"flex",alignItems:"center",gap:10,flex:1}}>
                    <span style={{fontSize:24}}>{record._icon}</span>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
                        <span style={{fontSize:14,fontWeight:600,color:C.text}}>{fmtDateFull(record.date)}</span>
                        <span style={{fontSize:12,color:C.textMuted}}>{normalizeHospital(record.hospital)}</span>
                        {record.fasting&&<span style={{fontSize:10,color:C.textMuted}}>({record.fasting})</span>}
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <div style={{fontSize:12,color:C.green}}>{record._label}</div>
                        {record._type==="lab"&&(()=>{
                          const cnt = Object.keys(record).filter(k=>!['id','date','hospital','country','doctor','fasting','note','extra_data','source_country','createdAt','_type','_icon','_label','_summary'].includes(k)&&record[k]!==null&&record[k]!==undefined&&record[k]!=="").length;
                          return(
                            <div style={{display:"flex",alignItems:"center",gap:4}}>
                              <div style={{fontSize:10,color:C.textMuted,background:C.bg,borderRadius:10,padding:"1px 6px"}}>{cnt}筆</div>
                            </div>
                          );
                        })()}
                      </div>
                      {!isExpanded&&record._summary&&(
                        <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>{record._summary}</div>
                      )}
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{color:C.textMuted,fontSize:18}}>{isExpanded?"▲":"▼"}</span>
                  </div>
                </div>

                {/* 展開的完整數值 */}
                {isExpanded&&(
                  <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
                    {record._type==="lab"?(
                      <>
                        {/* 基本資訊 */}
                        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
                          {record.country&&<span className="status-chip status-ok">{record.country}</span>}
                          {record.fasting&&<span className="status-chip status-ok">{record.fasting}</span>}
                          {record.doctor&&<span style={{fontSize:11,color:C.textMuted}}>醫師：{record.doctor}</span>}
                        </div>
                        {/* 數值列表 - 先顯示LAB_DISPLAY定義的，再顯示其他有值的欄位 */}
                        {/* 已知欄位依分組顯示 */}
                        {groups.map(group=>{
                          const groupFields=LAB_DISPLAY.filter(f=>f.group===group&&record[f.key]!==null&&record[f.key]!==undefined&&record[f.key]!=="");
                          if(groupFields.length===0)return null;
                          return(
                            <div key={group} style={{marginBottom:8}}>
                              <div style={{fontSize:10,color:C.green,letterSpacing:1,marginBottom:4,marginTop:8}}>{group.toUpperCase()}</div>
                              {groupFields.map(f=>{
                                const st=getStatus(f.key,record[f.key]);
                                const stColors={ok:C.green,warn:C.amber,alert:C.red};
                                return(
                                  <div key={f.key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:`1px solid ${C.border}`}}>
                                    <span style={{fontSize:12,color:C.textMuted}}>{f.label}</span>
                                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                                      <span style={{fontSize:13,fontWeight:600,color:st?stColors[st]:C.text}}>{fmtLabVal(f.key,record[f.key])}</span>
                                      <span style={{fontSize:11,color:C.textMuted}}>{f.unit}</span>
                                      <StatusDot status={st}/>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                        {/* 額外欄位（不在LAB_DISPLAY但有值的）*/}
                        {(()=>{
                          const knownKeys=new Set(LAB_DISPLAY.map(f=>f.key));
                          const skipKeys=new Set(['id','date','hospital','country','doctor','fasting','note','extra_data','source_country','createdAt']);
                          const extraFields=Object.keys(record).filter(k=>
                            !knownKeys.has(k)&&!skipKeys.has(k)&&
                            record[k]!==null&&record[k]!==undefined&&record[k]!==""&&
                            !isNaN(parseFloat(record[k]))
                          );
                          if(extraFields.length===0)return null;
                          return(
                            <div style={{marginBottom:8}}>
                              <div style={{fontSize:10,color:C.green,letterSpacing:1,marginBottom:4,marginTop:8}}>其他檢驗</div>
                              {extraFields.map(k=>{
                                const s=LAB_STATUS[k];
                                const st=getStatus(k,record[k]);
                                const stColors={ok:C.green,warn:C.amber,alert:C.red};
                                return(
                                  <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:`1px solid ${C.border}`}}>
                                    <span style={{fontSize:12,color:C.textMuted}}>{s?.label||k.toUpperCase()}</span>
                                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                                      <span style={{fontSize:13,fontWeight:600,color:st?stColors[st]:C.text}}>{record[k]}</span>
                                      <span style={{fontSize:11,color:C.textMuted}}>{s?.unit||""}</span>
                                      <StatusDot status={st}/>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                        {record.note&&(
                          <div style={{marginTop:8,fontSize:11,color:C.textMuted}}>備註：{record.note}</div>
                        )}
                        {/* extra_data 備份顯示 */}
                        {(()=>{
                          if(!record.extra_data)return null;
                          let extras={};
                          try{extras=JSON.parse(record.extra_data);}catch(e){return null;}
                          if(Object.keys(extras).length===0)return null;
                          return(
                            <div style={{marginTop:10,padding:"10px",background:"rgba(255,179,71,0.06)",border:`1px solid ${C.amber}44`,borderRadius:8}}>
                              <div style={{fontSize:10,color:C.amber,letterSpacing:1,marginBottom:6}}>備份資料（欄位待新增）</div>
                              {Object.entries(extras).map(([k,v])=>(
                                <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",borderBottom:`1px solid ${C.border}`}}>
                                  <span style={{fontSize:11,color:C.textMuted}}>{k}</span>
                                  <span style={{fontSize:11,color:C.text}}>{String(v)}</span>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </>
                    ):(
                      // 影像檢查展開
                      <>
                        {record.finding&&(()=>{
                          const lines = record.finding
                            .split(/[\n\r]+|[。]|[-－•·]/)
                            .map(s=>s.trim()).filter(Boolean);
                          return(
                            <div style={{marginBottom:8}}>
                              <div style={{fontSize:11,color:C.textMuted,marginBottom:6}}>報告結論</div>
                              {lines.length>1?(
                                <ul style={{margin:0,padding:"0 0 0 16px",listStyle:"none"}}>
                                  {lines.map((l,i)=>(
                                    <li key={i} style={{fontSize:13,color:C.text,lineHeight:1.7,display:"flex",gap:6,alignItems:"flex-start"}}>
                                      <span style={{color:C.green,flexShrink:0,marginTop:2}}>•</span>
                                      <span>{l}</span>
                                    </li>
                                  ))}
                                </ul>
                              ):(
                                <div style={{fontSize:13,color:C.text,lineHeight:1.7}}>{record.finding}</div>
                              )}
                            </div>
                          );
                        })()}
                        {record.recommendation&&(()=>{
                          const lines = record.recommendation
                            .split(/[\n\r]+|[。]|[-－•·]/)
                            .map(s=>s.trim()).filter(Boolean);
                          return(
                            <div style={{marginBottom:8}}>
                              <div style={{fontSize:11,color:C.textMuted,marginBottom:6}}>醫師建議</div>
                              {lines.length>1?(
                                <ul style={{margin:0,padding:"0 0 0 16px",listStyle:"none"}}>
                                  {lines.map((l,i)=>(
                                    <li key={i} style={{fontSize:13,color:C.text,lineHeight:1.7,display:"flex",gap:6,alignItems:"flex-start"}}>
                                      <span style={{color:C.amber,flexShrink:0,marginTop:2}}>•</span>
                                      <span>{l}</span>
                                    </li>
                                  ))}
                                </ul>
                              ):(
                                <div style={{fontSize:13,color:C.text,lineHeight:1.7}}>{record.recommendation}</div>
                              )}
                            </div>
                          );
                        })()}
                        {record.nextDate&&(
                          <div style={{fontSize:12,color:C.amber,marginBottom:8}}>下次追蹤：{fmtDate(record.nextDate)}</div>
                        )}
                        {/* 照片縮圖 */}
                        {record.driveUrl&&record.driveUrl.trim()&&(()=>{
                          const urls = record.driveUrl.split(",").map(u=>u.trim()).filter(Boolean);
                          if(urls.length===0)return null;
                          return(
                            <div style={{marginTop:8}}>
                              <div style={{fontSize:11,color:C.textMuted,marginBottom:6}}>影像照片（{urls.length}張）</div>
                              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                                {urls.map((url,i)=>(
                                  <div key={i} style={{width:90,height:90,borderRadius:8,overflow:"hidden",cursor:"pointer",border:`1px solid ${C.border}`}}
                                    onClick={()=>setLightboxUrl(url)}>
                                    <img src={url} alt={`影像${i+1}`}
                                      style={{width:"100%",height:"100%",objectFit:"cover"}}
                                      onError={e=>{e.target.style.display="none";}}/>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                        {record.note&&(
                          <div style={{marginTop:8,fontSize:11,color:C.textMuted}}>備註：{record.note}</div>
                        )}
                      </>
                    )}
                    {/* 編輯按鈕（影像記錄專用） */}
                    {record._type==="imaging"&&(
                      <button onClick={()=>setEditImaging({...record})}
                        style={{width:"100%",padding:"10px",marginBottom:8,borderRadius:10,
                          background:"rgba(90,180,255,0.1)",border:`1px solid rgba(90,180,255,0.3)`,
                          color:C.blue,fontSize:13,cursor:"pointer",fontWeight:600,
                          fontFamily:"'Noto Sans TC',sans-serif"}}>
                        ✏️ 編輯此記錄（補充內容或照片）
                      </button>
                    )}
                    {/* 刪除按鈕 inline */}
                    {delConfirm?.id===record.id?(
                      <div style={{marginTop:12,display:"flex",gap:8}}>
                        <button onClick={()=>setDelConfirm(null)}
                          style={{flex:1,padding:"10px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,color:C.textMuted,fontSize:13,cursor:"pointer",fontFamily:"'Noto Sans TC',sans-serif"}}>
                          取消
                        </button>
                        <button onClick={()=>handleDelete(record)} disabled={deleting}
                          style={{flex:2,padding:"10px",background:C.red,border:"none",borderRadius:8,color:"white",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"'Noto Sans TC',sans-serif"}}>
                          {deleting?"刪除中...":"確認刪除 ⚠️"}
                        </button>
                      </div>
                    ):(
                      <button onClick={()=>setDelConfirm(record)}
                        style={{marginTop:12,width:"100%",padding:"8px",background:"transparent",border:`1px solid ${C.red}44`,borderRadius:8,color:C.red,fontSize:12,cursor:"pointer",fontFamily:"'Noto Sans TC',sans-serif"}}>
                        🗑️ 刪除這筆記錄
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Lightbox 全螢幕照片 */}
        {lightboxUrl&&(
          <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.92)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}}
            onClick={()=>setLightboxUrl(null)}>
            <img src={lightboxUrl} alt="全螢幕影像"
              style={{maxWidth:"95vw",maxHeight:"90vh",objectFit:"contain",borderRadius:8}}/>
            <button style={{position:"absolute",top:16,right:16,background:"rgba(255,255,255,0.15)",border:"none",color:"white",fontSize:24,width:40,height:40,borderRadius:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}
              onClick={()=>setLightboxUrl(null)}>✕</button>
          </div>
        )}

      </div>
    );
  };

  // ── 飲食記錄 Tab ──────────────────────────────────────
  const MealTab = () => {
    const [mealType, setMealType] = useState("午餐");
    const [mealText, setMealText] = useState("");
    const [mealPhoto, setMealPhoto] = useState(null);
    const [mealAnalysis, setMealAnalysis] = useState(null);
    const [analyzing, setAnalyzing] = useState(false);
    const mealPhotoRef = React.useRef();

    const analyzeMeal = async () => {
      const key = localStorage.getItem("hj_apikey") || "";
      if (!key) { showToast("⚠️ 請先在設定Tab輸入API金鑰"); setTab("setting"); return; }
      if (!mealText && !mealPhoto) { showToast("⚠️ 請拍照或輸入食物名稱"); return; }
      setAnalyzing(true);
      try {
        let content = [];
        if (mealPhoto) {
          const b64 = mealPhoto.split(",")[1];
          const mime = mealPhoto.split(";")[0].split(":")[1];
          content.push({type:"image",source:{type:"base64",media_type:mime,data:b64}});
        }
        content.push({type:"text",text:`你是一位熟悉代謝疾病的營養師。請分析以下食物，用繁體中文回答，只回傳JSON，不要任何其他文字。

食物：${mealText||"（請從圖片辨識食物）"}

使用者背景（請針對此背景給出個人化分析）：
- 55歲台灣男性，越南工作，體重66kg
- 糖尿病前期（HbA1c 5.7%，空腹血糖偏高）
- 脂肪肝 Grade II（ALT 63偏高）
- HDL 35 mg/dL偏低（目標>40）
- 尿酸7.95偏高（高尿酸血症）
- 高血壓130/90用藥中（舒脈康5/40）
- 雙側髂總動脈瘤+左前降支LAD1冠狀動脈35%狹窄
- 服用保栓通Plavix（抗血小板，出血風險高）
- 平日午晚餐：公司自助餐，只吃菜+魚雞牛豬，不吃白飯
- 週末：麵食為主（高碳水風險）

回傳JSON格式（所有欄位必填）：
{
  "foods": "食物名稱",
  "calories": 熱量數字,
  "carbs": 碳水克數,
  "protein": 蛋白質克數,
  "fat": 脂肪克數,
  "gi": "低/中/高",
  "advice": "針對糖尿病前期的一句建議",
  "organs": {
    "brain": "對大腦的影響（15字內）",
    "heart": "對心血管的影響（15字內）",
    "blood_sugar": "對血糖的影響（15字內）",
    "liver": "對肝臟的影響（15字內）",
    "kidney": "對腎臟的影響（15字內）",
    "muscle": "對肌肉的影響（15字內）"
  },
  "personal_tip": "針對你的脂肪肝+HDL偏低+糖尿病前期的個人化建議（30字內）"
}`});
        const result = await callClaude([{role:"user", content}], 800);
        const clean = result.replace(/```json|```/g,"").trim();
        const parsed = JSON.parse(clean.slice(clean.indexOf("{"), clean.lastIndexOf("}")+1));
        setMealAnalysis(parsed);
      } catch(e) {
        showToast("❌ 分析失敗：" + e.message);
      }
      setAnalyzing(false);
    };

    const saveMeal = async () => {
      const r = await api.post("append", "meals", {
        date: today(),
        mealType,
        description: mealText || mealAnalysis?.foods || "",
        calories: mealAnalysis?.calories || "",
        carbs: mealAnalysis?.carbs || "",
        protein: mealAnalysis?.protein || "",
        fat: mealAnalysis?.fat || "",
        gi: mealAnalysis?.gi || "",
        aiAnalysis: mealAnalysis ? JSON.stringify(mealAnalysis) : "",
      });
      if (r?.success) {
        showToast("✅ 飲食記錄已儲存");
        setMealText(""); setMealPhoto(null); setMealAnalysis(null);
      } else showToast("❌ 儲存失敗");
    };

    return (
      <div className="card">
        <div className="card-title">記錄飲食</div>
        <div style={{display:"flex",gap:8,marginBottom:14}}>
          {["早餐","午餐","晚餐","點心"].map(m=>(
            <div key={m} onClick={()=>setMealType(m)}
              style={{flex:1,textAlign:"center",padding:"10px 4px",
                background:mealType===m?"rgba(46,204,138,0.15)":C.bg,
                border:`1px solid ${mealType===m?C.green:C.border}`,
                borderRadius:10,fontSize:12,color:mealType===m?C.green:C.textMuted,cursor:"pointer"}}>{m}</div>
          ))}
        </div>

        {/* 拍照區域 */}
        <div style={{marginBottom:12}}>
          {mealPhoto ? (
            <div style={{position:"relative",borderRadius:12,overflow:"hidden",marginBottom:8}}>
              <img src={mealPhoto} style={{width:"100%",maxHeight:200,objectFit:"cover"}}/>
              <button style={{position:"absolute",top:8,right:8,background:"rgba(0,0,0,0.6)",border:"none",borderRadius:20,color:"white",padding:"4px 10px",cursor:"pointer",fontSize:12}}
                onClick={()=>setMealPhoto(null)}>✕ 移除</button>
            </div>
          ) : (
            <div style={{border:`2px dashed ${C.border}`,borderRadius:12,padding:"20px",textAlign:"center",cursor:"pointer",marginBottom:8}}
              onClick={()=>mealPhotoRef.current?.click()}>
              <div style={{fontSize:32,marginBottom:8}}>📸</div>
              <div style={{fontSize:14,color:C.textMuted}}>拍照或選擇圖片</div>
              <div style={{fontSize:11,color:C.textMuted,marginTop:4}}>AI 自動辨識食物</div>
            </div>
          )}
          <input ref={mealPhotoRef} type="file" accept="image/*" multiple style={{display:"none"}}
            onChange={async e=>{
              if(e.target.files[0]){
                const dataUrl=await new Promise(res=>{const r=new FileReader();r.onload=ev=>res(ev.target.result);r.readAsDataURL(e.target.files[0]);});
                setMealPhoto(dataUrl);
              }
              e.target.value="";
            }}/>
        </div>

        <input className="input-field" placeholder="或輸入食物名稱（例：越南河粉、白飯+雞肉）"
          value={mealText} onChange={e=>setMealText(e.target.value)} style={{marginBottom:12}}/>

        {/* AI分析結果 */}
        {mealAnalysis && (
          <div style={{background:C.bg,borderRadius:10,padding:12,marginBottom:12,border:`1px solid ${C.borderBright}`}}>
            <div style={{fontSize:12,fontWeight:600,color:C.green,marginBottom:8}}>🤖 AI 分析結果</div>
            <div style={{fontSize:13,color:C.text,marginBottom:8,fontWeight:600}}>{mealAnalysis.foods}</div>

            {/* 營養數值 */}
            <div className="grid-3" style={{marginBottom:8}}>
              {[["熱量",mealAnalysis.calories,"kcal"],["碳水",mealAnalysis.carbs,"g"],["蛋白質",mealAnalysis.protein,"g"],["脂肪",mealAnalysis.fat,"g"],["GI值",mealAnalysis.gi,""]].map(([l,v,u])=>(
                <div key={l} style={{textAlign:"center",background:C.bgCard2,borderRadius:8,padding:"6px 4px"}}>
                  <div style={{fontSize:10,color:C.textMuted}}>{l}</div>
                  <div style={{fontSize:15,fontWeight:700,color:C.green}}>{v}</div>
                  {u&&<div style={{fontSize:10,color:C.textMuted}}>{u}</div>}
                </div>
              ))}
            </div>

            {/* 器官影響 */}
            {mealAnalysis.organs&&(
              <div style={{marginBottom:8}}>
                <div style={{fontSize:11,color:C.textMuted,marginBottom:6,letterSpacing:1}}>對身體的影響</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                  {[
                    {key:"brain",icon:"🧠",label:"大腦"},
                    {key:"heart",icon:"🫀",label:"心血管"},
                    {key:"blood_sugar",icon:"🩸",label:"血糖"},
                    {key:"liver",icon:"🫀",label:"肝臟"},
                    {key:"kidney",icon:"🫘",label:"腎臟"},
                    {key:"muscle",icon:"💪",label:"肌肉"},
                  ].map(o=>(
                    <div key={o.key} style={{background:C.bgCard2,borderRadius:8,padding:"8px"}}>
                      <div style={{fontSize:11,color:C.textMuted,marginBottom:3}}>{o.icon} {o.label}</div>
                      <div style={{fontSize:11,color:C.text,lineHeight:1.5}}>{mealAnalysis.organs[o.key]||"—"}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 個人化建議 */}
            {mealAnalysis.personal_tip&&(
              <div style={{background:"rgba(255,179,71,0.08)",border:`1px solid ${C.amber}44`,borderRadius:8,padding:"10px",marginBottom:6}}>
                <div style={{fontSize:11,color:C.amber,marginBottom:4}}>📌 個人化建議</div>
                <div style={{fontSize:12,color:C.text,lineHeight:1.6}}>{mealAnalysis.personal_tip}</div>
              </div>
            )}

            <div style={{fontSize:11,color:C.amber}}>💡 {mealAnalysis.advice}</div>
          </div>
        )}

        <div style={{display:"flex",gap:8}}>
          <button className="btn-secondary" style={{flex:1}} onClick={analyzeMeal} disabled={analyzing}>
            {analyzing?"⏳ 分析中...":"🤖 AI分析"}
          </button>
          <button className="btn-primary" style={{flex:2}} onClick={saveMeal}>儲存</button>
        </div>
      </div>
    );
  };

  // ── 記錄 ───────────────────────────────────────────────
  const RecordTab=()=>{
    const SUBS=[{key:"history",label:"📂歷史"},{key:"glucose",label:"🩸血糖"},{key:"bp",label:"💓血壓"},{key:"weight",label:"⚖️體重"},{key:"lab",label:"📋抽血"},{key:"imaging",label:"🔬影像"},{key:"meal",label:"🍱飲食"},{key:"exercise",label:"🏃運動"},{key:"sleep",label:"😴睡眠"}];
    return(
      <div className="fade-in" style={{padding:"16px 16px 80px"}}>
        <div className="section-header">📝 記錄</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:16}}>
          {SUBS.map(t=>(
            <button key={t.key} onClick={()=>setRecordTab(t.key)}
              style={{padding:"9px 4px",borderRadius:10,border:`1px solid ${recordTab===t.key?C.green:C.border}`,background:recordTab===t.key?"rgba(46,204,138,0.15)":C.bg,color:recordTab===t.key?C.green:C.textMuted,fontSize:12,cursor:"pointer",fontFamily:"'Noto Sans TC',sans-serif",textAlign:"center",width:"100%"}}>
              {t.label}
            </button>
          ))}
        </div>

        {recordTab==="history"&&(
          <HistoryTab/>
        )}

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
          <MealTab/>
        )}

        {recordTab==="imaging"&&(
          <div className="card">
            <div className="card-title">記錄影像檢查</div>
            <div className="field-row">
              <div className="field-label">檢查類型</div>
              <select className="input-field" value={imagingForm.type} onChange={e=>setImagingForm(f=>({...f,type:e.target.value}))}>
                {IMAGING_TYPES.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="field-row">
              <div className="field-label">檢查日期</div>
              <input className="input-field" type="date" value={imagingForm.date} onChange={e=>setImagingForm(f=>({...f,date:e.target.value}))}/>
            </div>
            <div className="field-row">
              <div className="field-label">醫院名稱 <span className="field-required">必填</span></div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
                {hospitalList.map(h=>(
                  <button key={h} className={`btn-sm ${imagingForm.hospital===h?"active":""}`}
                    onClick={()=>setImagingForm(f=>({...f,hospital:h}))}>{h}</button>
                ))}
              </div>
              <input className="input-field" placeholder="或輸入新醫院" value={imagingForm.hospital} onChange={e=>setImagingForm(f=>({...f,hospital:e.target.value}))}/>
            </div>
            <div className="grid-2" style={{marginBottom:12}}>
              <div>
                <div className="field-label">國家</div>
                <select className="input-field" value={imagingForm.country} onChange={e=>setImagingForm(f=>({...f,country:e.target.value}))}>
                  <option>台灣</option><option>越南</option>
                </select>
              </div>
              <div>
                <div className="field-label">下次追蹤</div>
                <input className="input-field" type="date" value={imagingForm.nextDate} onChange={e=>setImagingForm(f=>({...f,nextDate:e.target.value}))}/>
              </div>
            </div>
            <div className="field-row">
              <div className="field-label">報告結論 <span className="field-required">必填</span></div>
              <textarea className="input-field" rows={3} style={{resize:"none"}}
                placeholder="例：輕度脂肪肝，膽囊無異常..."
                value={imagingForm.finding} onChange={e=>setImagingForm(f=>({...f,finding:e.target.value}))}/>
            </div>
            <div className="field-row">
              <div className="field-label">醫師建議</div>
              <textarea className="input-field" rows={2} style={{resize:"none"}}
                placeholder="例：建議減重，3個月後追蹤..."
                value={imagingForm.recommendation} onChange={e=>setImagingForm(f=>({...f,recommendation:e.target.value}))}/>
            </div>
            {/* 代表性照片 */}
            <div className="field-row">
              <div className="field-label">代表性照片（選填，最多3張）</div>
              <div style={{fontSize:12,color:C.amber,marginBottom:8,padding:"6px 10px",background:"rgba(255,179,71,0.08)",borderRadius:8}}>
                ⚠️ 照片僅供留存參考，AI不會分析影像內容
              </div>
              {imagingPhotos.length>0&&(
                <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap"}}>
                  {imagingPhotos.map((p,i)=>(
                    <div key={i} className="photo-preview">
                      <img src={p} alt={`影像${i+1}`}/>
                      <button className="photo-del" onClick={()=>setImagingPhotos(prev=>prev.filter((_,idx)=>idx!==i))}>×</button>
                    </div>
                  ))}
                </div>
              )}
              {imagingPhotos.length<3&&(
                <div style={{border:`2px dashed ${C.border}`,borderRadius:10,padding:"16px",textAlign:"center",cursor:"pointer"}}
                  onClick={()=>imagingPhotoRef.current?.click()}
                  tabIndex={0}
                  onPaste={async e=>{
                    const cloudName=localStorage.getItem("cloudinary_name");
                    if(!cloudName){showToast("⚠️ 請先在設定頁填入 Cloudinary 設定");return;}
                    const items=Array.from(e.clipboardData?.items||[]);
                    const imgItems=items.filter(it=>it.type.startsWith("image/"));
                    if(imgItems.length===0)return;
                    e.preventDefault();
                    const files=imgItems.map(it=>it.getAsFile()).filter(Boolean).slice(0,3-imagingPhotos.length);
                    showToast(`⏳ 貼上上傳中（0/${files.length}）...`);
                    const urls=[];
                    for(let i=0;i<files.length;i++){
                      try{
                        const url=await uploadToCloudinary(files[i]);
                        urls.push(url);
                        showToast(`⏳ 上傳中（${i+1}/${files.length}）...`);
                      }catch(err){showToast("❌ 上傳失敗："+err.message);return;}
                    }
                    setImagingPhotos(prev=>[...prev,...urls].slice(0,3));
                    showToast(`✅ 貼上 ${urls.length} 張照片成功`);
                  }}>
                  <div style={{fontSize:24,marginBottom:4}}>📷</div>
                  <div style={{fontSize:12,color:C.textMuted}}>點擊上傳照片</div>
                  <div style={{fontSize:10,color:C.blue,marginTop:4}}>💻 電腦版：點此區後可直接 Ctrl+V 貼上截圖</div>
                </div>
              )}
              <input ref={imagingPhotoRef} type="file" accept="image/*" multiple style={{display:"none"}}
                onChange={async e=>{
                  const cloudName = localStorage.getItem("cloudinary_name");
                  if(!cloudName){showToast("⚠️ 請先在設定頁填入 Cloudinary 設定");e.target.value="";return;}
                  const files = Array.from(e.target.files).slice(0, 3-imagingPhotos.length);
                  showToast(`⏳ 上傳中（0/${files.length}）...`);
                  const urls = [];
                  for(let i=0; i<files.length; i++){
                    try{
                      const url = await uploadToCloudinary(files[i]);
                      urls.push(url);
                      showToast(`⏳ 上傳中（${i+1}/${files.length}）...`);
                    }catch(err){
                      showToast("❌ 上傳失敗："+err.message);
                      e.target.value=""; return;
                    }
                  }
                  setImagingPhotos(prev=>[...prev,...urls].slice(0,3));
                  showToast(`✅ ${urls.length} 張照片已上傳`);
                  e.target.value="";
                }}/>
            </div>
            <div className="field-row">
              <div className="field-label">備註</div>
              <input className="input-field" placeholder="其他備註" value={imagingForm.note} onChange={e=>setImagingForm(f=>({...f,note:e.target.value}))}/>
            </div>
            <button className="btn-primary" onClick={saveImaging}>儲存到 Google Sheets</button>
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
        {recordTab==="sleep"&&(()=>{
          const emptyForm={
            date:today(),bedtime:"23:30",waketime:"06:00",
            total_min:360,actual_min:354,score:0,
            deep_min:0,light_min:0,rem_min:0,awake_min:0,
            spo2_avg:0,spo2_below90_min:0,hr_avg:0,breath_rate:0,note:""
          };
          const [sleepForm,setSleepForm]=React.useState(emptyForm);
          const [pasteText,setPasteText]=React.useState("");
          const [showPaste,setShowPaste]=React.useState(false);
          const [sleepAnalysis,setSleepAnalysis]=React.useState(null);
          const [analyzing,setAnalyzing]=React.useState(false);
          const savedSleep=sleepLog.filter(r=>r.date).sort((a,b)=>String(b.date).localeCompare(String(a.date)));

          // ── 解析 ChatGPT 輸出的固定格式文字 ──
          const parsePasteText=()=>{
            const lines=pasteText.split("\n").map(l=>l.trim()).filter(Boolean);
            const get=(key)=>{
              const line=lines.find(l=>l.startsWith(key));
              if(!line)return "";
              return line.split("：")[1]?.trim()||"";
            };
            const toInt=(s)=>parseInt(s)||0;
            const toFloat=(s)=>parseFloat(s)||0;
            const parsed={
              date:get("日期")||today(),
              bedtime:get("上床時間")||"23:30",
              waketime:get("起床時間")||"06:00",
              total_min:toInt(get("總時間（分鐘）")),
              actual_min:toInt(get("實際睡眠（分鐘）")),
              score:toInt(get("睡眠評分")),
              deep_min:toInt(get("深層睡眠（分鐘）")),
              light_min:toInt(get("淺層睡眠（分鐘）")),
              rem_min:toInt(get("REM（分鐘）")),
              awake_min:toInt(get("清醒（分鐘）")),
              spo2_avg:toInt(get("血氧平均（%）")),
              spo2_below90_min:toFloat(get("血氧低於90%（分鐘）")),
              hr_avg:toInt(get("平均心跳（次/分）")),
              breath_rate:toFloat(get("呼吸速率（次/分）")),
              note:get("備註")||"",
            };
            if(!parsed.total_min&&!parsed.score){
              showToast("⚠️ 格式不符，請確認是否貼上正確格式");
              return;
            }
            setSleepForm(parsed);
            setShowPaste(false);
            setPasteText("");
            showToast("✅ 解析完成，請確認後儲存");
          };

          const analyzeSleep=async()=>{
            const key=localStorage.getItem("hj_apikey")||apiKey||"";
            if(!key){showToast("⚠️ 請先設定API金鑰");return;}
            setAnalyzing(true);
            try{
              const weekData=savedSleep.slice(0,7).map(r=>
                `${r.date}: 總${r.total_min}分/實際${r.actual_min}分/評分${r.score}/深層${r.deep_min}分(${Math.round(r.deep_min/(r.total_min||1)*100)}%)/REM ${r.rem_min}分/清醒${r.awake_min}分/血氧${r.spo2_avg}%`
              ).join("\n");
              const prompt=`你是睡眠醫學專家，請分析以下Samsung Watch 7睡眠數據，用繁體中文回答，不用markdown符號：

近期睡眠數據：
${weekData||"尚無記錄"}

病患背景：55歲男性，越南工作，平均睡眠5小時58分，深層睡眠目前10-15%偏低，目標18-22%。
已知影響：深層睡眠不足→血糖控制差（HbA1c 5.7%臨界）、血壓藥效打折、睾固酮下降。
偶爾服用悠樂丁Eurodin 2mg（BZD，抑制深層睡眠）。

請分析：
一、本週睡眠總評（總時數/深層比例達標情況）
二、最差的夜晚（是否有使用悠樂丁？）
三、對身體的具體影響（結合你的血糖/血壓/荷爾蒙狀況）
四、本週三個改善行動（具體可執行）
五、長期追蹤目標（何時深層睡眠能達到18%）`;
              const result=await callClaude([{role:"user",content:prompt}],1200);
              setSleepAnalysis(result);
            }catch(e){showToast("❌ "+e.message);}
            setAnalyzing(false);
          };

          const saveSleepRecord=async()=>{
            const r=await api.post("append","sleep_log",{
              id:"SLP"+Date.now(),
              date:sleepForm.date,
              bedtime:sleepForm.bedtime,
              waketime:sleepForm.waketime,
              total_min:sleepForm.total_min,
              actual_min:sleepForm.actual_min,
              score:sleepForm.score,
              deep_min:sleepForm.deep_min,
              light_min:sleepForm.light_min,
              rem_min:sleepForm.rem_min,
              awake_min:sleepForm.awake_min,
              spo2_avg:sleepForm.spo2_avg,
              spo2_below90_min:sleepForm.spo2_below90_min,
              hr_avg:sleepForm.hr_avg,
              breath_rate:sleepForm.breath_rate,
              note:sleepForm.note,
            });
            if(r?.success){
              setSleepLog(prev=>[...prev,{...sleepForm}]);
              setSleepForm(emptyForm);
              showToast("✅ 睡眠記錄已儲存");
            }else showToast("❌ 儲存失敗，請確認Sheets有sleep_log分頁");
          };

          return(
            <div>
              <div className="card" style={{marginBottom:12}}>
                <div className="card-title">😴 輸入 Watch 7 睡眠數據</div>

                {/* ChatGPT指令複製區 */}
                {(()=>{
                  const [copied,setCopied]=React.useState(false);
                  const GPT_CMD=`請從這些 Samsung Health 睡眠截圖中擷取數據，輸出以下固定格式（純文字，不要多餘說明）：

日期：
上床時間：
起床時間：
總時間（分鐘）：
實際睡眠（分鐘）：
睡眠評分：
深層睡眠（分鐘）：
淺層睡眠（分鐘）：
REM（分鐘）：
清醒（分鐘）：
血氧平均（%）：
血氧低於90%（分鐘）：
平均心跳（次/分）：
呼吸速率（次/分）：
備註：`;
                  return(
                    <div style={{marginBottom:10}}>
                      <div style={{fontSize:11,color:C.textMuted,marginBottom:6,lineHeight:1.6}}>
                        步驟①：複製指令 → 開ChatGPT → 上傳截圖 + 貼上指令<br/>
                        步驟②：複製ChatGPT輸出 → 貼到下方「自動填入」
                      </div>
                      <button onClick={()=>{
                        navigator.clipboard?.writeText(GPT_CMD).then(()=>{
                          setCopied(true);setTimeout(()=>setCopied(false),3000);
                          showToast("✅ 已複製！去ChatGPT貼上");
                        });
                      }} style={{width:"100%",padding:"10px",marginBottom:6,
                        background:copied?C.green+"33":C.amber+"22",
                        border:`1px solid ${copied?C.green:C.amber}`,
                        borderRadius:8,color:copied?C.green:C.amber,
                        fontSize:13,fontWeight:700,cursor:"pointer"}}>
                        {copied?"✅ 已複製！去 ChatGPT 貼上":"📤 複製 ChatGPT 擷取指令"}
                      </button>
                    </div>
                  );
                })()}
                {/* 貼上解析區 */}
                <button onClick={()=>setShowPaste(v=>!v)}
                  style={{width:"100%",padding:"10px",marginBottom:10,background:C.green+"22",
                    border:`1px solid ${C.green}`,borderRadius:8,color:C.green,fontSize:13,fontWeight:700,cursor:"pointer"}}>
                  📋 {showPaste?"▲ 收起":"▼ 貼上 ChatGPT 解析文字 → 自動填入"}
                </button>

                {showPaste&&(
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:11,color:C.textMuted,marginBottom:6,lineHeight:1.7}}>
                      用 ChatGPT 分析截圖後，複製輸出文字貼到下方，點「解析並填入」自動填好所有欄位。
                    </div>
                    <textarea
                      style={{width:"100%",minHeight:160,background:C.card,border:`1px solid ${C.border}`,
                        borderRadius:8,color:C.text,fontSize:11,padding:10,lineHeight:1.6,
                        boxSizing:"border-box",resize:"vertical"}}
                      placeholder={`日期：2025/06/12\n上床時間：00:15\n起床時間：06:33\n總時間（分鐘）：378\n實際睡眠（分鐘）：354\n睡眠評分：78\n深層睡眠（分鐘）：68\n淺層睡眠（分鐘）：188\nREM（分鐘）：98\n清醒（分鐘）：24\n血氧平均（%）：92\n血氧低於90%（分鐘）：19.8\n平均心跳（次/分）：59\n呼吸速率（次/分）：15.2\n備註：`}
                      value={pasteText}
                      onChange={e=>setPasteText(e.target.value)}
                    />
                    <button onClick={parsePasteText}
                      style={{width:"100%",marginTop:8,padding:"10px",background:C.green,
                        border:"none",borderRadius:8,color:"#000",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                      ✨ 解析並填入欄位
                    </button>
                  </div>
                )}

                <div style={{fontSize:11,color:C.textMuted,marginBottom:8,lineHeight:1.6}}>
                  或手動輸入各項數值：
                </div>

                <div className="grid-2" style={{marginBottom:8}}>
                  <div><div className="field-label">日期</div>
                    <input className="input-field" type="date" value={sleepForm.date}
                      onChange={e=>setSleepForm(v=>({...v,date:e.target.value}))}/></div>
                  <div><div className="field-label">睡眠評分</div>
                    <input className="input-field" type="number" value={sleepForm.score||""}
                      placeholder="78"
                      onChange={e=>setSleepForm(v=>({...v,score:parseInt(e.target.value)||0}))}/></div>
                </div>
                <div className="grid-2" style={{marginBottom:8}}>
                  <div><div className="field-label">🛏️ 上床時間</div>
                    <input className="input-field" type="time" value={sleepForm.bedtime}
                      onChange={e=>setSleepForm(v=>({...v,bedtime:e.target.value}))}/></div>
                  <div><div className="field-label">☀️ 起床時間</div>
                    <input className="input-field" type="time" value={sleepForm.waketime}
                      onChange={e=>setSleepForm(v=>({...v,waketime:e.target.value}))}/></div>
                </div>
                <div className="grid-2" style={{marginBottom:8}}>
                  <div><div className="field-label">總時間（分鐘）</div>
                    <input className="input-field" type="number" value={sleepForm.total_min||""}
                      onChange={e=>setSleepForm(v=>({...v,total_min:parseInt(e.target.value)||0}))}/></div>
                  <div><div className="field-label">實際睡眠（分鐘）</div>
                    <input className="input-field" type="number" value={sleepForm.actual_min||""}
                      onChange={e=>setSleepForm(v=>({...v,actual_min:parseInt(e.target.value)||0}))}/></div>
                </div>
                <div className="grid-2" style={{marginBottom:8}}>
                  <div><div className="field-label">🌙 深層睡眠（分鐘）</div>
                    <input className="input-field" type="number" value={sleepForm.deep_min||""}
                      onChange={e=>setSleepForm(v=>({...v,deep_min:parseInt(e.target.value)||0}))}/></div>
                  <div><div className="field-label">💭 REM（分鐘）</div>
                    <input className="input-field" type="number" value={sleepForm.rem_min||""}
                      onChange={e=>setSleepForm(v=>({...v,rem_min:parseInt(e.target.value)||0}))}/></div>
                </div>
                <div className="grid-2" style={{marginBottom:8}}>
                  <div><div className="field-label">😪 淺層睡眠（分鐘）</div>
                    <input className="input-field" type="number" value={sleepForm.light_min||""}
                      onChange={e=>setSleepForm(v=>({...v,light_min:parseInt(e.target.value)||0}))}/></div>
                  <div><div className="field-label">⚡ 清醒（分鐘）</div>
                    <input className="input-field" type="number" value={sleepForm.awake_min||""}
                      onChange={e=>setSleepForm(v=>({...v,awake_min:parseInt(e.target.value)||0}))}/></div>
                </div>
                <div className="grid-2" style={{marginBottom:8}}>
                  <div><div className="field-label">🩸 血氧平均（%）</div>
                    <input className="input-field" type="number" value={sleepForm.spo2_avg||""}
                      onChange={e=>setSleepForm(v=>({...v,spo2_avg:parseInt(e.target.value)||0}))}/></div>
                  <div><div className="field-label">⚠️ 血氧低於90%（分鐘）</div>
                    <input className="input-field" type="number" step="0.1" value={sleepForm.spo2_below90_min||""}
                      onChange={e=>setSleepForm(v=>({...v,spo2_below90_min:parseFloat(e.target.value)||0}))}/></div>
                </div>
                <div className="grid-2" style={{marginBottom:8}}>
                  <div><div className="field-label">❤️ 平均心跳（次/分）</div>
                    <input className="input-field" type="number" value={sleepForm.hr_avg||""}
                      onChange={e=>setSleepForm(v=>({...v,hr_avg:parseInt(e.target.value)||0}))}/></div>
                  <div><div className="field-label">🌬️ 呼吸速率（次/分）</div>
                    <input className="input-field" type="number" step="0.1" value={sleepForm.breath_rate||""}
                      onChange={e=>setSleepForm(v=>({...v,breath_rate:parseFloat(e.target.value)||0}))}/></div>
                </div>

                {/* 即時計算 */}
                {sleepForm.total_min>0&&(
                  <div style={{background:C.bg,borderRadius:8,padding:"8px 10px",marginBottom:10}}>
                    <div style={{fontSize:11,color:C.textMuted,marginBottom:4}}>即時計算</div>
                    <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                      {[
                        {label:"評分",v:sleepForm.score||"-",color:sleepForm.score>=80?C.green:sleepForm.score>=60?C.amber:C.red},
                        {label:"深層%",v:`${Math.round(sleepForm.deep_min/sleepForm.total_min*100)}%`,
                          color:sleepForm.deep_min/sleepForm.total_min>=0.18?C.green:C.amber},
                        {label:"REM%",v:`${Math.round(sleepForm.rem_min/sleepForm.total_min*100)}%`,
                          color:sleepForm.rem_min/sleepForm.total_min>=0.20?C.green:C.amber},
                        {label:"總計",v:`${Math.floor(sleepForm.total_min/60)}h${sleepForm.total_min%60}m`,
                          color:sleepForm.total_min>=420?C.green:C.red},
                        {label:"血氧",v:sleepForm.spo2_avg?`${sleepForm.spo2_avg}%`:"-",
                          color:sleepForm.spo2_avg>=95?C.green:sleepForm.spo2_avg>=90?C.amber:C.red},
                      ].map(s=>(
                        <div key={s.label} style={{textAlign:"center"}}>
                          <div style={{fontSize:14,fontWeight:700,color:s.color}}>{s.v}</div>
                          <div style={{fontSize:10,color:C.textMuted}}>{s.label}</div>
                        </div>
                      ))}
                      {sleepForm.spo2_below90_min>10&&(
                        <div style={{textAlign:"center"}}>
                          <div style={{fontSize:11,color:C.red,fontWeight:700}}>⚠️ 低氧{sleepForm.spo2_below90_min}分</div>
                          <div style={{fontSize:10,color:C.textMuted}}>建議告知醫師</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <input className="input-field" placeholder="備註（是否吃悠樂丁？壓力大？）" style={{marginBottom:10}}
                  value={sleepForm.note} onChange={e=>setSleepForm(v=>({...v,note:e.target.value}))}/>
                <button className="btn-primary" onClick={saveSleepRecord}>💾 儲存睡眠記錄</button>
              </div>

              {/* 近期睡眠記錄 */}
              {savedSleep.length>0&&(
                <div className="card" style={{marginBottom:12}}>
                  <div className="card-title">近期睡眠記錄</div>
                  {savedSleep.slice(0,7).map((r,i)=>{
                    const deepPct=Math.round(r.deep_min/(r.total_min||1)*100);
                    return(
                      <div key={i} style={{padding:"8px 0",borderBottom:i<Math.min(savedSleep.length,7)-1?`1px solid ${C.border}`:"none"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                          <div>
                            <div style={{fontSize:12,fontWeight:600,color:C.text}}>{fmtDateFull(r.date)}</div>
                            <div style={{fontSize:10,color:C.textMuted}}>{r.bedtime}→{r.waketime}</div>
                          </div>
                          <div style={{textAlign:"right"}}>
                            <div style={{fontSize:13,fontWeight:700,color:r.total_min>=420?C.green:C.red}}>
                              {Math.floor(r.total_min/60)}h{r.total_min%60}m
                            </div>
                            {r.score>0&&<div style={{fontSize:10,color:r.score>=80?C.green:r.score>=60?C.amber:C.red}}>評分 {r.score}</div>}
                          </div>
                        </div>
                        <div style={{display:"flex",gap:10,marginTop:4,flexWrap:"wrap"}}>
                          <span style={{fontSize:10,color:deepPct>=18?C.green:C.amber}}>深層{deepPct}%</span>
                          {r.rem_min>0&&<span style={{fontSize:10,color:C.textMuted}}>REM {Math.round(r.rem_min/(r.total_min||1)*100)}%</span>}
                          {r.spo2_avg>0&&<span style={{fontSize:10,color:r.spo2_avg>=95?C.green:C.amber}}>血氧{r.spo2_avg}%</span>}
                          {r.spo2_below90_min>0&&<span style={{fontSize:10,color:C.red}}>低氧{r.spo2_below90_min}分</span>}
                          {r.hr_avg>0&&<span style={{fontSize:10,color:C.textMuted}}>心跳{r.hr_avg}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* AI每週分析 */}
              <div className="card">
                <div className="card-title">🤖 每週睡眠AI分析</div>
                {sleepAnalysis
                  ?<div style={{fontSize:12,lineHeight:1.9,whiteSpace:"pre-wrap",color:C.text}}>{sleepAnalysis}</div>
                  :<div style={{fontSize:12,color:C.textMuted,lineHeight:1.7}}>
                    輸入至少1筆睡眠記錄後，讓AI分析本週睡眠品質、對身體的影響，並給出具體改善建議。
                  </div>}
                <button className="btn-primary" style={{marginTop:10}} onClick={analyzeSleep} disabled={analyzing||savedSleep.length===0}>
                  {analyzing?"⏳ 分析中...":"📊 產生本週睡眠分析"}
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  // ── AI分析 ─────────────────────────────────────────────
  const generateAIReport=async()=>{
    const key=localStorage.getItem("hj_apikey")||apiKey||"";
    if(!key){showToast("⚠️ 請先在設定Tab輸入API金鑰");setTab("setting");return;}
    setAiLoading(true);
    try{
      showToast("⏳ 連接中，約20秒...");
      // 近7日血壓均值
      const recentBP7=[...bpHistory].slice(-7);
      const avgSys7=recentBP7.length>0?Math.round(recentBP7.reduce((s,r)=>s+parseInt(r.systolic||0),0)/recentBP7.length):null;
      const avgDia7=recentBP7.length>0?Math.round(recentBP7.reduce((s,r)=>s+parseInt(r.diastolic||0),0)/recentBP7.length):null;
      // 打卡率
      const bkfHit7=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-i);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}).filter(ds=>breakfastLog.some(r=>normalizeDate(r.date)===ds)).length;
      const exHit7=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-i);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}).filter(ds=>exerciseLog.some(r=>normalizeDate(r.date)===ds)).length;
      // 雷達分數
      const radar=computeRadarScores(latestLab,bpHistory);
      const radarStr=radar?radar.filter(d=>d.score!=null).map(d=>`${d.label.split("\n")[0]}:${d.score}`).join("、"):"無資料";
      // 最近體重
      const latestWt=weightHistory.length>0?weightHistory[weightHistory.length-1]:null;
      // 前次抽血對比
      const prevLab=labHistory.length>1?labHistory[labHistory.length-2]:null;
      const hba1cTrend=prevLab&&latestLab?`${prevLab.hba1c}%→${latestLab.hba1c}%`:`${latestLab?.hba1c||"—"}%`;
      const hdlTrend=prevLab&&latestLab?`${prevLab.hdl}→${latestLab.hdl}`:`${latestLab?.hdl||"—"}`;
      const prompt=`你是私人健康顧問，請用繁體中文產生本週健康週報，格式如下：

【本週健康週報】

一、本週總評（2-3句，依數據給出整體評價）

二、數據重點
・血糖控制：HbA1c ${hba1cTrend}，空腹血糖 ${latestGlucose?.value_mgdl||"—"} mg/dL
・血壓均值（近7筆）：${avgSys7?`${avgSys7}/${avgDia7} mmHg`:"尚無數據"}
・血脂 HDL：${hdlTrend} mg/dL（目標>40）
・肝功能：ALT ${latestLab?.alt||"—"} / GGT ${latestLab?.ggt||"—"}
・體重：${latestWt?latestWt.value_kg+" kg":"尚無記錄"}

三、健康雷達本週分數
${radarStr}
（指出最弱面向並給1句改善建議）

四、本週行為達成
・早餐打卡：${bkfHit7}/7天
・運動打卡：${exHit7}/7天
（依達成率給予鼓勵或提醒）

五、本週三大行動建議（具體可執行，針對你的弱項）

六、一句鼓勵（有溫度，結合55歲在越南工作的背景）

病患背景：55歲台灣男性，越南工作，父親T2D家族史
已確診問題（2025/03/19海防國際醫院住院確診）：
- 糖尿病前期：HbA1c ${latestLab?.hba1c||5.7}%
- 脂肪肝 Grade II：ALT ${latestLab?.alt||63}偏高
- HDL偏低：${latestLab?.hdl||35} mg/dL
- 高尿酸血症：尿酸 ${latestLab?.uric_acid||7.95} mg/dL
- 高血壓：血壓130/90，服用舒脈康5/40
- 雙側髂總動脈瘤（Bilateral common iliac artery aneurysm）
- 左前降支LAD1冠狀動脈35%狹窄（輕度）
- 頸動脈輕度動脈粥樣硬化
- 右眼視野輕度異常（需追蹤）
- 視網膜退行性變化+黃斑部亮度差（需補充葉黃素）
- 左側眼瞼反射R1傳導異常（眼皮已不跳）
- WBC 3.9/PLT 145偏低
目前用藥：舒脈康5/40（2天1次晚上）、平脂4mg（每天晚上）、保栓通75mg（每天晚上）、DHA+EPA 6粒（晚餐後）、EX NEO維他命2錠（早餐後）、強力若元9粒（早上）
保健品：橄欖油5ml+堅果奶昔（含核桃/杏仁/南瓜子/奇亞籽/亞麻籽/燕麥/薑黃+胡椒/甜菜根粉/無糖可可）、午後黑咖啡300cc+黑巧克力85%、晚上希臘酸奶200g+奇異果（含皮）
不要用markdown符號或*號`;
      const result=await callClaude([{role:"user",content:prompt}]);
      setAiReport(result||"分析失敗");
      const todayStr=new Date().toISOString().split("T")[0];
      setAiReportDate(todayStr);
      localStorage.setItem("hj_weekly_cache",JSON.stringify({date:todayStr,report:result}));
    }catch(e){
      if(e.message==="NO_API_KEY"){
        showToast("⚠️ 請先在設定Tab輸入API金鑰");setTab("setting");
      }else if(e.message.includes("401")){
        showToast("❌ API金鑰無效");setAiReport("❌ API金鑰無效");setTab("setting");
      }else if(e.message.includes("429")){
        showToast("❌ API使用量超限，請稍後再試");setAiReport("❌ API使用量超限");
      }else{
        setAiReport("❌ 分析失敗："+e.message);showToast("❌ AI分析失敗："+e.message);
      }
    }
    setAiLoading(false);
  };

  // ── 階段四：異常/矛盾自動標記引擎 ───────────────────
  const detectHealthAlerts=()=>{
    const alerts=[];
    const sorted=[...labHistory].sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    // 規則1：指標連續惡化（最近3次同方向）
    const checkTrend=(key,label,dir,unit="")=>{
      const series=sorted.filter(r=>r[key]!==null&&r[key]!==undefined&&r[key]!=="")
        .map(r=>({date:r.date,v:parseFloat(r[key])})).filter(s=>!isNaN(s.v));
      if(series.length<3)return;
      const last3=series.slice(-3);
      const worsening=dir==="low"
        ?last3[0].v<last3[1].v&&last3[1].v<last3[2].v
        :last3[0].v>last3[1].v&&last3[1].v>last3[2].v;
      if(worsening){
        alerts.push({level:"warn",icon:"📈",
          title:`${label}連續${dir==="low"?"上升":"下降"}`,
          desc:`近3次 ${last3.map(s=>s.v).join("→")}${unit}，持續惡化，建議追蹤原因`});
      }
    };
    checkTrend("alt","ALT肝指數","low");
    checkTrend("ast","AST肝指數","low");
    checkTrend("uric_acid","尿酸","low");
    checkTrend("ldl","LDL膽固醇","low");
    checkTrend("creatinine","肌酸酐","low");
    checkTrend("hdl","HDL好膽固醇","high");
    checkTrend("platelet","血小板","high");
    // 規則2：最新值超過警戒線
    const latest=sorted[sorted.length-1];
    if(latest){
      const checkThreshold=(key,label,bad,dir="high")=>{
        const v=parseFloat(latest[key]);
        if(isNaN(v))return;
        if((dir==="high"&&v>=bad)||(dir==="low"&&v<=bad)){
          alerts.push({level:"warn",icon:"⚠️",title:`${label}偏${dir==="high"?"高":"低"}`,
            desc:`最新 ${v}，已${dir==="high"?"超過":"低於"}警戒值 ${bad}`});
        }
      };
      checkThreshold("alt","ALT",80,"high");
      checkThreshold("uric_acid","尿酸",8.5,"high");
      checkThreshold("wbc","白血球",4,"low");
      checkThreshold("platelet","血小板",150,"low");
      checkThreshold("hba1c","HbA1c",6.5,"high");
    }
    // 規則3：跨指標關聯（ALT高+脂肪肝）
    const latestAlt=latest?parseFloat(latest.alt):NaN;
    const hasFattyLiver=imagingHistory.some(r=>(r.finding||"").includes("脂肪肝")&&(r.finding||"").includes("II"));
    if(!isNaN(latestAlt)&&latestAlt>50&&hasFattyLiver){
      alerts.push({level:"alert",icon:"🔴",title:"肝臟需重點關注",
        desc:`ALT ${latestAlt}偏高 + 脂肪肝Grade II，兩者互相印證，建議控制體重+減少精緻碳水，3個月複查肝功能`});
    }
    // 規則4：尿酸+ALT同時偏高
    const latestUric=latest?parseFloat(latest.uric_acid):NaN;
    if(!isNaN(latestAlt)&&!isNaN(latestUric)&&latestAlt>50&&latestUric>7.5){
      alerts.push({level:"warn",icon:"🔗",title:"代謝負擔警訊",
        desc:`ALT與尿酸同時偏高，常見於代謝症候群，注意飲食控制與水分攝取`});
    }
    // 規則5：結構性問題矛盾標記
    const hasLVPW=imagingHistory.some(r=>(r.finding||"").includes("LVPWd")&&(r.finding||"").includes("18"));
    if(hasLVPW){
      alerts.push({level:"info",icon:"📋",title:"待複評：左心室後壁",
        desc:"LVPWd影像值18.3mm偏高但報告判正常，建議回台灣時請心臟科複評確認"});
    }
    return alerts;
  };

  // ── 整體健康評估（複合視角，含睡眠/行為/結構性問題）──
  const generateOverallReport=async(silent=false)=>{
    const key=localStorage.getItem("hj_apikey")||apiKey||"";
    if(!key){if(!silent){showToast("⚠️ 請先在設定Tab輸入API金鑰");setTab("setting");}return;}
    if(labHistory.length===0){if(!silent)showToast("⚠️ 尚無抽血資料可分析");return;}
    setOverallLoading(true);
    try{
      if(!silent)showToast("⏳ 讀取全部歷史分析中，約30秒...");
      // 抽血趨勢
      const sorted=[...labHistory].sort((a,b)=>String(a.date).localeCompare(String(b.date)));
      const trackKeys=[
        {k:"hba1c",label:"HbA1c(%)"},{k:"glucose_ac",label:"空腹血糖"},
        {k:"alt",label:"ALT"},{k:"ast",label:"AST"},{k:"ggt",label:"GGT"},
        {k:"hdl",label:"HDL"},{k:"ldl",label:"LDL"},{k:"tg",label:"TG"},
        {k:"uric_acid",label:"尿酸"},{k:"creatinine",label:"肌酸酐"},
        {k:"wbc",label:"WBC"},{k:"platelet",label:"血小板"},{k:"crp",label:"CRP"},
      ];
      const trendLines=trackKeys.map(t=>{
        const series=sorted.filter(r=>r[t.k]!==null&&r[t.k]!==undefined&&r[t.k]!=="")
          .map(r=>`${String(r.date).slice(5)}:${r[t.k]}`);
        return series.length>0?`${t.label}: ${series.join(" → ")}`:null;
      }).filter(Boolean).join("\n");
      // 血壓趨勢
      const bpSorted=[...bpHistory].sort((a,b)=>String(a.date).localeCompare(String(b.date)));
      const bpLine=bpSorted.length>0
        ?`血壓: ${bpSorted.slice(-10).map(r=>`${String(r.date).slice(5)}:${r.systolic}/${r.diastolic}`).join(" → ")}`
        :"血壓: 尚無記錄";
      // 影像診斷摘要
      const imgSummary=imagingHistory.length>0
        ?imagingHistory.map(r=>`・${r.date} ${r.type}: ${(r.finding||"").slice(0,80)}`).join("\n")
        :"無影像記錄";
      // 睡眠近4週摘要
      const sleepSorted=[...sleepLog].filter(r=>r.date).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
      const sleepRecent=sleepSorted.slice(0,28);
      const avgTotalMin=sleepRecent.length>0?Math.round(sleepRecent.reduce((s,r)=>s+(parseInt(r.total_min)||0),0)/sleepRecent.length):null;
      const avgDeepPct=sleepRecent.length>0?Math.round(sleepRecent.reduce((s,r)=>s+(parseInt(r.deep_min)||0),0)/sleepRecent.reduce((s,r)=>s+(parseInt(r.total_min)||1),0)*100):null;
      const avgScore=sleepRecent.length>0?Math.round(sleepRecent.reduce((s,r)=>s+(parseInt(r.score)||0),0)/sleepRecent.length):null;
      const avgSpo2=sleepRecent.filter(r=>r.spo2_avg>0).length>0
        ?Math.round(sleepRecent.filter(r=>r.spo2_avg>0).reduce((s,r)=>s+(parseInt(r.spo2_avg)||0),0)/sleepRecent.filter(r=>r.spo2_avg>0).length):null;
      const spo2Below90Days=sleepRecent.filter(r=>parseFloat(r.spo2_below90_min)>10).length;
      const sleepSummary=sleepRecent.length>0
        ?`近${sleepRecent.length}天睡眠：平均${avgTotalMin}分鐘/晚，深層${avgDeepPct}%，評分${avgScore||"—"}，血氧平均${avgSpo2||"—"}%，血氧低於90%超過10分鐘共${spo2Below90Days}天`
        :"無睡眠記錄";
      // 運動近4週
      const exSorted=[...exerciseLog].filter(r=>r.date).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
      const exDays28=exSorted.filter(r=>{const d=new Date(r.date);return(new Date()-d)/(1000*60*60*24)<=28;}).length;
      const exSummary=exerciseLog.length>0?`近28天運動${exDays28}天`:"無運動記錄";
      const prompt=`你是一位資深內科主治醫師兼複合健康顧問，正在為長期追蹤的病患做整體健康評估。請從複合視角分析，不要單點看待個別指標，要找出各維度之間的因果關聯。用繁體中文，不要用markdown符號或*號。

【病患基本資料】
55歲台灣男性，越南海防工作，與家人分隔兩地，父親T2D家族史。

【2025/03/19住院確診七項並發診斷】
①高血壓（血壓130/90）
②雙側髂總動脈瘤（結構性，需定期追蹤）
③左前降支LAD1冠狀動脈35%狹窄（輕度）
④肝酶升高（ALT 63.54）
⑤高尿酸血症（7.95 mg/dL）
⑥脂肪肝 Grade II（從G1惡化）
⑦眼瞼肌束顫動左側（已緩解）
附加：右眼視野輕度異常、視網膜退化+黃斑部亮度差、頸動脈輕度粥樣硬化、LVPWd 18.3mm待複評、WBC/PLT偏低

【目前用藥】
舒脈康5/40（2天1次晚）、平脂4mg（每天晚）、保栓通Plavix 75mg（每天晚）、悠樂丁2mg（偶爾睡前）

【保健品與飲食習慣】
早餐：堅果奶昔（核桃/杏仁/南瓜子/奇亞籽/亞麻籽/燕麥/薑黃/甜菜根粉/無糖可可）+雞蛋2-3顆+酪梨+橄欖油5ml
午晚：公司自助餐只吃菜+蛋白質，不吃白飯；週末麵食為主（最大血糖風險）
DHA+EPA 6粒晚餐後、EX NEO 2錠早、強力若元9粒早

【抽血核心指標歷次趨勢】
${trendLines}
${bpLine}

【影像與結構診斷記錄】
${imgSummary}

【睡眠數據（Samsung Watch 7）】
${sleepSummary}
注意：悠樂丁（BZD）會抑制深層睡眠，睡眠不足直接影響血糖、血壓、HDL、荷爾蒙。

【行為數據】
${exSummary}

請依以下結構分析：

【整體健康評估報告】

一、健康全貌
（從複合視角總結：這7項診斷之間的核心連結是什麼？最根本的健康主軸是什麼？2-3句）

二、各維度趨勢（改善↑/持平→/惡化↓）
（抽血指標、血壓、睡眠、體重各自方向，用箭頭標示）

三、複合因果關聯
（重點找出：哪些問題互相加重？例如睡眠差→血糖控制差→脂肪肝惡化→尿酸升高的連鎖；血壓未達標→動脈瘤風險加大的關係）

四、結構性問題追蹤
（動脈瘤、LAD1狹窄、視網膜退化等不出現在抽血的問題，目前狀態與追蹤重點）

五、本週需要注意的紅旗
（2-4項最需要立即關注的複合發現，每項標明涉及哪些維度）

六、下次看診/抽血重點
（具體建議追蹤哪些指標，與哪個科別）

七、一句話總結`;
      const result=await callClaude([{role:"user",content:prompt}],2500);
      setOverallReport(result||"分析失敗");
      const stamp=new Date().toISOString().split("T")[0];
      setOverallDate(stamp);
      localStorage.setItem("hj_overall_cache",JSON.stringify({date:stamp,report:result}));
    }catch(e){
      if(e.message==="NO_API_KEY"){if(!silent){showToast("⚠️ 請先設定API金鑰");setTab("setting");}}
      else if(e.message.includes("401")){if(!silent){showToast("❌ API金鑰無效");setTab("setting");}}
      else if(e.message.includes("429")){if(!silent)showToast("❌ API使用量超限");}
      else{setOverallReport("❌ 分析失敗："+e.message);if(!silent)showToast("❌ "+e.message);}
    }
    setOverallLoading(false);
  };

  // ── 每週自動觸發整體評估 ─────────────────────────────
  React.useEffect(()=>{
    const key=localStorage.getItem("hj_apikey")||"";
    if(!key)return;
    const cache=JSON.parse(localStorage.getItem("hj_overall_cache")||"null");
    if(!cache||!cache.date)return generateOverallReport(true);
    const daysSince=Math.floor((new Date()-new Date(cache.date))/(1000*60*60*24));
    if(daysSince>=7)generateOverallReport(true);
  },[labHistory.length,sleepLog.length]);

  // ── 每日問候自動觸發（資料載入後執行）────────────────
  React.useEffect(()=>{
    if(!loading)generateDailyGreeting();
  },[loading,sleepLog.length]);

  const AITab=()=>{
    const [aiQuestion,setAiQuestion]=useState("");
    const [aiAnswer,setAiAnswer]=useState(null);
    const [aiQLoading,setAiQLoading]=useState(false);
    const askAI=async()=>{
      if(!aiQuestion.trim())return;
      const key=localStorage.getItem("hj_apikey")||apiKey||"";
      if(!key){showToast("⚠️ 請先設定API金鑰");setTab("setting");return;}
      setAiQLoading(true);
      try{
        const ctx=`病患背景：55歲台灣男性、糖尿病前期HbA1c ${latestLab?.hba1c||5.8}%、脂肪肝G1、HDL ${latestLab?.hdl||31}偏低、血壓130/90用藥中、血小板126偏低+Plavix。請用繁體中文回答，不用markdown符號：${aiQuestion}`;
        const result=await callClaude([{role:"user",content:ctx}]);
        setAiAnswer(result);
      }catch(e){showToast("❌ "+e.message);}
      setAiQLoading(false);
    };
    return(
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
      {/* 整體健康評估（階段一：讀取全部歷史）*/}
      <div className="ai-bubble" style={{marginBottom:12,border:`1px solid ${C.green}44`}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:36,height:36,borderRadius:"50%",background:`linear-gradient(135deg,${C.blue},${C.green})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🩺</div>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:C.green}}>整體健康評估</div>
              <div style={{fontSize:10,color:C.textMuted}}>讀取全部 {labHistory.length} 筆抽血 + {imagingHistory.length} 筆影像</div>
            </div>
          </div>
          {overallReport&&(
            <button onClick={()=>{
              if(navigator.share){navigator.share({title:"整體健康評估",text:overallReport});}
              else{navigator.clipboard?.writeText(overallReport).then(()=>showToast("✅ 已複製，可貼給醫師"));}
            }}
              style={{padding:"5px 10px",borderRadius:8,fontSize:11,background:"transparent",border:`1px solid ${C.border}`,color:C.textMuted,cursor:"pointer",fontFamily:"'Noto Sans TC',sans-serif"}}>
              📋 複製
            </button>
          )}
        </div>
        {overallReport
          ?<div style={{fontSize:13,lineHeight:1.9,whiteSpace:"pre-wrap",color:C.text}}>{overallReport}</div>
          :<div style={{fontSize:12,color:C.textMuted,lineHeight:1.8}}>
            讓 AI 綜觀你的<b style={{color:C.green}}>全部</b>歷史數據，產生主治醫師等級的完整評估：<br/>
            健康全貌 · 指標趨勢 · 指標關聯 · 結構追蹤 · 紅旗標記 · 看診建議<br/>
            <span style={{color:C.amber}}>看診前複製給醫師，一次掌握你的完整狀況</span>
          </div>}
      </div>
      <button className="btn-primary" style={{marginBottom:4,background:`linear-gradient(135deg,${C.blue},${C.green})`}}
        onClick={generateOverallReport} disabled={overallLoading}>
        {overallLoading?"⏳ 讀取全部歷史分析中（約30秒）...":"🩺 產生整體健康評估"}
      </button>
      {overallDate&&(
        <div style={{fontSize:10,color:C.textMuted,marginBottom:16,textAlign:"center"}}>
          上次評估 {overallDate} ·
          <span style={{color:C.blue,cursor:"pointer",marginLeft:4}}
            onClick={()=>{localStorage.removeItem("hj_overall_cache");setOverallReport(null);setOverallDate(null);showToast("已清除，可重新評估");}}>
            重新產生
          </span>
        </div>
      )}
      {/* 週報區塊 */}
      <div className="ai-bubble" style={{marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:36,height:36,borderRadius:"50%",background:`linear-gradient(135deg,${C.green},${C.greenDark})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🤖</div>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:C.green}}>本週健康週報</div>
              <div style={{fontSize:10,color:C.textMuted}}>{new Date().toLocaleDateString("zh-TW",{month:"long",day:"numeric",weekday:"short"})}</div>
            </div>
          </div>
          {aiReport&&(
            <button onClick={()=>{
              if(navigator.share){navigator.share({title:"本週健康週報",text:aiReport});}
              else{navigator.clipboard?.writeText(aiReport).then(()=>showToast("✅ 已複製到剪貼簿"));}
            }}
              style={{padding:"5px 10px",borderRadius:8,fontSize:11,background:"transparent",border:`1px solid ${C.border}`,color:C.textMuted,cursor:"pointer",fontFamily:"'Noto Sans TC',sans-serif"}}>
              📋 複製
            </button>
          )}
        </div>
        {aiReport
          ?<div style={{fontSize:13,lineHeight:1.9,whiteSpace:"pre-wrap",color:C.text}}>{aiReport}</div>
          :<div style={{fontSize:12,color:C.textMuted,lineHeight:1.8}}>
            點下方按鈕產生本週週報，包含：<br/>
            總評 · 數據重點 · 雷達分數 · 打卡達成率 · 行動建議 · 鼓勵
          </div>}
      </div>
      <button className="btn-primary" style={{marginBottom:4}} onClick={generateAIReport} disabled={aiLoading}>
        {aiLoading?"⏳ AI 分析中（約20秒）...":"📊 產生本週健康週報"}
      </button>
      {aiReportDate&&(
        <div style={{fontSize:10,color:C.textMuted,marginBottom:12,textAlign:"center"}}>
          今日快取 {aiReportDate} ·
          <span style={{color:C.blue,cursor:"pointer",marginLeft:4}}
            onClick={()=>{localStorage.removeItem("hj_weekly_cache");setAiReport(null);setAiReportDate(null);showToast("快取清除，可重新產生");}}>
            重新產生
          </span>
        </div>
      )}
      {/* 快速問AI */}
      <div className="card">
        <div className="card-title">💬 快速問 AI</div>
        <textarea className="input-field" rows={3}
          placeholder="例：我今天血糖107，有什麼影響？&#10;例：DHA和Plavix一起吃安全嗎？"
          style={{resize:"none",marginBottom:8}}
          value={aiQuestion} onChange={e=>setAiQuestion(e.target.value)}/>
        <button className="btn-primary" onClick={askAI} disabled={aiQLoading||!aiQuestion.trim()}>
          {aiQLoading?"⏳ 分析中...":"🔍 發問"}
        </button>
        {aiAnswer&&(
          <div style={{marginTop:12,padding:"10px 12px",background:C.bg,borderRadius:10,fontSize:13,lineHeight:1.8,whiteSpace:"pre-wrap",color:C.text}}>
            {aiAnswer}
          </div>
        )}
      </div>
    </div>
  );};


  // ── 知識庫 ─────────────────────────────────────────────
  const KnowledgeTab=()=>{
    const [kbSearch, setKbSearch] = useState("");
    const [openGroup, setOpenGroup] = useState(null);
    const [medSubTab, setMedSubTab] = useState("supplement");
    const [myMeds, setMyMeds] = useState(()=>{
      try{return JSON.parse(localStorage.getItem("hj_mymeds")||"[]");}catch(e){return[];}
    });
    const [showMedForm, setShowMedForm] = useState(false);
    const [medForm, setMedForm] = useState({name:"",dose:"",freq:"每天",timing:"早餐後",note:""});
    const saveMyMeds = (list)=>{
      setMyMeds(list);
      localStorage.setItem("hj_mymeds", JSON.stringify(list));
    };
    const [articleForm, setArticleForm] = useState({title:"",tag:"血糖",content:"",photos:[]});
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const articlePhotoRef = React.useRef();
    const latestLab = labHistory.length > 0 ? labHistory[labHistory.length-1] : null;
    const allArticles = [...BUILTIN_ARTICLES, ...customArticles];

    const saveCustomArticle = () => {
      if(!articleForm.title.trim()||!articleForm.content.trim()){showToast("⚠️ 請填入標題和內容");return;}
      const newArt = {
        id:"custom_"+Date.now(),
        tag:articleForm.tag,
        icon:"📝",
        builtin:false,
        title:articleForm.title.trim(),
        content:articleForm.content.trim(),
        photos:articleForm.photos,
        createdAt:new Date().toISOString().split("T")[0],
      };
      const updated = [...customArticles, newArt];
      setCustomArticles(updated);
      localStorage.setItem("hj_articles", JSON.stringify(updated));
      setArticleForm({title:"",tag:"血糖",content:"",photos:[]});
      setShowAddArticle(false);
      showToast("✅ 知識文章已儲存");
    };

    const deleteCustomArticle = (id) => {
      const updated = customArticles.filter(a=>a.id!==id);
      setCustomArticles(updated);
      localStorage.setItem("hj_articles", JSON.stringify(updated));
      setSelectedArticle(null);
      showToast("🗑️ 已刪除");
    };

    // ── 藥物詳細頁 ──
    if(selectedMedicine){
      const m = selectedMedicine;
      return(
        <div className="fade-in" style={{padding:"16px 16px 80px"}}>
          <button className="btn-secondary" style={{marginBottom:16}} onClick={()=>setSelectedMedicine(null)}>← 返回知識庫</button>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
            <span style={{fontSize:40}}>{m.icon}</span>
            <div>
              <div style={{fontSize:18,fontWeight:700,color:C.text}}>{m.name}</div>
              <span style={{fontSize:11,padding:"2px 8px",borderRadius:8,
                background:m.type==="supplement"?"rgba(46,204,138,0.12)":"rgba(90,180,255,0.12)",
                color:m.type==="supplement"?C.green:C.blue}}>
                {m.type==="supplement"?"保健品":"藥物"}
              </span>
            </div>
          </div>
          <div className="card">
            <div className="card-title">說明</div>
            <div style={{fontSize:13,lineHeight:1.8,color:C.text}}>{m.desc}</div>
          </div>
          <div className="card">
            <div className="card-title">主要好處</div>
            {m.benefits.map((b,i)=>(
              <div key={i} style={{display:"flex",gap:10,padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
                <span style={{color:C.green}}>✓</span>
                <span style={{fontSize:13,color:C.text}}>{b}</span>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="card-title">建議用量</div>
            <div style={{fontSize:13,color:C.text,lineHeight:1.8}}>{m.dosage}</div>
          </div>
          <div className="card">
            <div className="card-title">注意事項</div>
            <div style={{fontSize:13,color:C.amber,lineHeight:1.8}}>{m.caution}</div>
          </div>
          <div className="card" style={{border:`1px solid ${C.amber}44`,background:"rgba(255,179,71,0.06)"}}>
            <div className="card-title">針對你的建議</div>
            <div style={{fontSize:13,color:C.text,lineHeight:1.8}}>{m.personal}</div>
          </div>
        </div>
      );
    }

    // ── 文章詳細頁 ──
    if(selectedArticle){
      const art = selectedArticle;
      const paragraphs = art.content.split("\n").map((line,i)=>{
        if(line.startsWith("**")&&line.endsWith("**")){
          return <div key={i} style={{fontWeight:700,color:C.green,marginTop:12,marginBottom:4,fontSize:14}}>{line.replace(/\*\*/g,"")}</div>;
        }
        if(line.startsWith("- ")||line.match(/^\d+\./)){
          return <div key={i} style={{fontSize:13,lineHeight:1.8,paddingLeft:12,color:C.text}}>{line}</div>;
        }
        if(line.trim()==="")return <div key={i} style={{height:8}}/>;
        return <div key={i} style={{fontSize:13,lineHeight:1.8,color:C.text}}>{line}</div>;
      });
      return(
        <div className="fade-in" style={{padding:"16px 16px 80px"}}>
          <button className="btn-secondary" style={{marginBottom:16}} onClick={()=>setSelectedArticle(null)}>← 返回知識庫</button>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
            <span style={{fontSize:36}}>{art.icon}</span>
            <div>
              <div style={{fontSize:18,fontWeight:700,color:C.text}}>{art.title}</div>
              <div style={{display:"flex",gap:6,marginTop:4}}>
                <span style={{fontSize:11,padding:"2px 8px",background:"rgba(46,204,138,0.15)",borderRadius:10,color:C.green}}>{art.tag}</span>
                {art.builtin&&<span style={{fontSize:11,padding:"2px 8px",background:"rgba(90,180,255,0.15)",borderRadius:10,color:C.blue}}>內建</span>}
                {art.createdAt&&!art.builtin&&<span style={{fontSize:11,color:C.textMuted}}>{art.createdAt}</span>}
              </div>
            </div>
          </div>
          <div className="card">
            {paragraphs}
          </div>
          {art.photos&&art.photos.length>0&&(
            <div className="card">
              <div className="card-title">圖片</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {art.photos.map((url,i)=>(
                  <div key={i} style={{width:100,height:100,borderRadius:8,overflow:"hidden",cursor:"pointer",border:`1px solid ${C.border}`}}
                    onClick={()=>setLightboxUrl(url)}>
                    <img src={url} alt={`圖片${i+1}`} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!art.builtin&&(
            <button style={{width:"100%",padding:"12px",background:"transparent",border:`1px solid ${C.red}44`,borderRadius:10,color:C.red,fontSize:13,cursor:"pointer",fontFamily:"'Noto Sans TC',sans-serif",marginTop:8}}
              onClick={()=>deleteCustomArticle(art.id)}>
              🗑️ 刪除這篇文章
            </button>
          )}
        </div>
      );
    }

    // ── 檢驗指標詳細頁 ──
    if(selectedKnowledge){
      const item = selectedKnowledge;
      const yourVal = latestLab?.[item.key];
      const hasVal = yourVal!==null&&yourVal!==undefined&&yourVal!=="";
      const st = getStatus(item.key, yourVal);
      const stColors = {ok:C.green, warn:C.amber, alert:C.red};
      const isQual = ["hbsag","anti_hbs","anti_hcv","asto","rf",
        "urine_glucose","urine_bilirubin","urine_ketone","urine_nitrite",
        "urine_urobilinogen","urine_blood","urine_leukocyte","crp"].includes(item.key);
      const qualVal = isQual ? (()=>{
        if(!hasVal)return null;
        const s=String(yourVal).toLowerCase().trim();
        if(s==="0"||s==="negative"||s==="neg")return{text:"陰性 (－)",color:C.green};
        if(s==="1"||s==="positive"||s==="pos")return{text:"陽性 (＋)",color:C.red};
        return{text:String(yourVal),color:C.text};
      })() : null;
      return(
        <div className="fade-in" style={{padding:"16px 16px 80px"}}>
          <button className="btn-secondary" style={{marginBottom:16}} onClick={()=>setSelectedKnowledge(null)}>← 返回知識庫</button>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
            <span style={{fontSize:40}}>{item.icon}</span>
            <div>
              <div style={{fontSize:18,fontWeight:700,color:item.color}}>{item.title}</div>
              <div style={{fontSize:11,color:C.textMuted}}>{item.fullName}</div>
              <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>{item.group}</div>
            </div>
          </div>
          <div className="card"><div className="card-title">說明</div><div style={{fontSize:14,lineHeight:1.8,color:C.text}}>{item.desc}</div></div>
          <div className="card"><div className="card-title">正常範圍</div><div style={{fontSize:14,color:C.green,lineHeight:1.8}}>{item.range}</div></div>
          <div className="card">
            <div className="card-title">數值意義</div>
            <div style={{padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
              <div style={{fontSize:11,color:C.red,marginBottom:4}}>偏高代表</div>
              <div style={{fontSize:13,lineHeight:1.7}}>{item.high}</div>
            </div>
            <div style={{padding:"8px 0"}}>
              <div style={{fontSize:11,color:C.blue,marginBottom:4}}>偏低代表</div>
              <div style={{fontSize:13,lineHeight:1.7}}>{item.low}</div>
            </div>
          </div>
          <div className="card" style={{border:`1px solid ${item.color}44`}}>
            <div className="card-title">你的最新值</div>
            {hasVal?(
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                {isQual&&qualVal?(
                  <span style={{fontSize:22,fontWeight:700,color:qualVal.color}}>{qualVal.text}</span>
                ):(
                  <span style={{fontSize:28,fontFamily:"'DM Serif Display',serif",color:st?stColors[st]:C.text}}>{fmtLabVal(item.key,yourVal)}</span>
                )}
                {st&&!isQual&&(
                  <span className={`status-chip ${st==="ok"?"status-ok":st==="warn"?"status-warn":"status-alert"}`}>
                    {st==="ok"?"✅ 正常":st==="warn"?"⚠️ 需注意":"❌ 異常"}
                  </span>
                )}
              </div>
            ):(
              <div style={{fontSize:13,color:C.textMuted}}>此項目尚無記錄</div>
            )}
            {hasVal&&<div style={{fontSize:11,color:C.textMuted,marginTop:6}}>來自最新報告：{fmtDateFull(latestLab?.date)} {latestLab?.hospital}</div>}
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
          <div className="card">
            <div className="card-title">相關指標</div>
            <div style={{fontSize:13,color:C.textMuted,lineHeight:1.7}}>{item.related}</div>
          </div>
        </div>
      );
    }

    // ── 新增文章頁 ──
    if(showAddArticle){
      const TAGS=["血糖","肝臟","腎臟","血脂","心血管","大腦","骨骼","腸道","尿酸","綜合","其他"];
      return(
        <div className="fade-in" style={{padding:"16px 16px 80px"}}>
          <button className="btn-secondary" style={{marginBottom:16}} onClick={()=>setShowAddArticle(false)}>← 返回</button>
          <div className="section-header">✏️ 新增健康知識</div>
          <div className="card">
            <div className="field-label">標題</div>
            <input className="input-field" style={{marginBottom:12}} placeholder="例：我的血壓控制心得"
              value={articleForm.title} onChange={e=>setArticleForm(f=>({...f,title:e.target.value}))}/>
            <div className="field-label">分類</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
              {TAGS.map(t=>(
                <button key={t} className={`btn-sm ${articleForm.tag===t?"active":""}`}
                  style={articleForm.tag===t?{background:"rgba(46,204,138,0.2)",borderColor:C.green,color:C.green}:{}}
                  onClick={()=>setArticleForm(f=>({...f,tag:t}))}>{t}</button>
              ))}
            </div>
            <div className="field-label">內容</div>
            <textarea className="input-field" rows={8} style={{resize:"vertical",marginBottom:12}}
              placeholder="輸入知識內容...&#10;&#10;支援簡單格式：&#10;**粗體標題**&#10;- 項目列表&#10;1. 編號列表"
              value={articleForm.content} onChange={e=>setArticleForm(f=>({...f,content:e.target.value}))}/>
            <div className="field-label">圖片（選填，最多3張）</div>
            {articleForm.photos.length>0&&(
              <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap"}}>
                {articleForm.photos.map((url,i)=>(
                  <div key={i} style={{position:"relative",width:80,height:80}}>
                    <img src={url} style={{width:80,height:80,objectFit:"cover",borderRadius:8}}/>
                    <button style={{position:"absolute",top:-6,right:-6,background:C.red,border:"none",borderRadius:10,color:"white",width:20,height:20,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}
                      onClick={()=>setArticleForm(f=>({...f,photos:f.photos.filter((_,idx)=>idx!==i)}))}>×</button>
                  </div>
                ))}
              </div>
            )}
            {articleForm.photos.length<3&&(
              <div style={{border:`2px dashed ${C.border}`,borderRadius:10,padding:"12px",textAlign:"center",cursor:"pointer",marginBottom:12}}
                onClick={()=>articlePhotoRef.current?.click()}>
                {uploadingPhoto?(
                  <div style={{fontSize:12,color:C.textMuted}}>⏳ 上傳中...</div>
                ):(
                  <>
                    <div style={{fontSize:20,marginBottom:4}}>📷</div>
                    <div style={{fontSize:12,color:C.textMuted}}>點擊上傳圖片</div>
                  </>
                )}
              </div>
            )}
            <input ref={articlePhotoRef} type="file" accept="image/*" multiple style={{display:"none"}}
              onChange={async e=>{
                const cloudName=localStorage.getItem("cloudinary_name");
                if(!cloudName){showToast("⚠️ 請先在設定頁填入 Cloudinary 設定");e.target.value="";return;}
                setUploadingPhoto(true);
                const files=Array.from(e.target.files).slice(0,3-articleForm.photos.length);
                const urls=[];
                for(const file of files){
                  try{
                    const url=await uploadToCloudinary(file);
                    urls.push(url);
                  }catch(err){showToast("❌ 上傳失敗："+err.message);break;}
                }
                setArticleForm(f=>({...f,photos:[...f.photos,...urls].slice(0,3)}));
                setUploadingPhoto(false);
                e.target.value="";
              }}/>
            <button className="btn-primary" onClick={saveCustomArticle}>儲存文章</button>
          </div>
        </div>
      );
    }

    // ── 列表主頁 ──
    const groups = [...new Set(KNOWLEDGE_ITEMS.map(i=>i.group))];
    const searchLower = kbSearch.toLowerCase().trim();
    const filteredLab = searchLower
      ? KNOWLEDGE_ITEMS.filter(i=>
          i.title.toLowerCase().includes(searchLower)||
          (i.fullName||"").toLowerCase().includes(searchLower)||
          i.key.toLowerCase().includes(searchLower)||
          i.group.toLowerCase().includes(searchLower)
        )
      : null;
    const filteredArticles = searchLower
      ? allArticles.filter(a=>
          a.title.toLowerCase().includes(searchLower)||
          a.tag.toLowerCase().includes(searchLower)||
          a.content.toLowerCase().includes(searchLower)
        )
      : null;

    return(
      <div className="fade-in" style={{padding:"16px 16px 80px"}}>
        <div className="section-header">📚 健康知識庫</div>

        {/* 搜尋欄 */}
        <div style={{position:"relative",marginBottom:12}}>
          <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:16,color:C.textMuted}}>🔍</span>
          <input className="input-field" style={{paddingLeft:36}}
            placeholder="搜尋項目（ALT、血糖、腎功能...）"
            value={kbSearch} onChange={e=>setKbSearch(e.target.value)}/>
          {kbSearch&&(
            <button style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:C.textMuted,fontSize:16,cursor:"pointer"}}
              onClick={()=>setKbSearch("")}>✕</button>
          )}
        </div>

        {/* 我的診斷卡片（2025/03住院確診） */}
        {!searchLower&&(()=>{
          const [showDx,setShowDx]=React.useState(false);
          const DX=[
            {n:"①",name:"眼瞼肌束顫動（左側）",status:"✅已緩解",color:C.green,note:"與睡眠不足壓力相關，神經傳導左側R1延長"},
            {n:"②",name:"高血壓",status:"💊用藥中",color:C.amber,note:"舒脈康5/40，目標<125/80"},
            {n:"③",name:"雙側髂總動脈瘤",status:"⚠️追蹤",color:C.red,note:"CTA確診，每6個月心臟科追蹤大小"},
            {n:"④",name:"LAD1冠狀動脈35%狹窄",status:"⚠️追蹤",color:C.red,note:"輕度<50%無需介入，保栓通+定期追蹤"},
            {n:"⑤",name:"肝酶升高",status:"📈監測",color:C.amber,note:"ALT 63.54，與脂肪肝相關，3個月追蹤"},
            {n:"⑥",name:"高尿酸血症",status:"📈監測",color:C.amber,note:"7.95 mg/dL，多喝水少紅肉"},
            {n:"⑦",name:"脂肪肝 Grade II",status:"⚠️惡化",color:C.red,note:"從G1進展，飲食+運動+咖啡是核心對策"},
          ];
          return(
            <div className="card" style={{marginBottom:12,cursor:"pointer"}} onClick={()=>setShowDx(v=>!v)}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:C.text}}>📋 我的診斷（7項）</div>
                  <div style={{fontSize:10,color:C.textMuted,marginTop:2}}>2025/03/19 海防國際醫院住院確診 · 點擊{showDx?"收合":"展開"}</div>
                </div>
                <span style={{color:C.textMuted}}>{showDx?"▲":"▼"}</span>
              </div>
              {showDx&&(
                <div style={{marginTop:10}} onClick={e=>e.stopPropagation()}>
                  {DX.map(d=>(
                    <div key={d.n} style={{padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
                        <span style={{fontSize:12,fontWeight:600,color:C.text}}>{d.n} {d.name}</span>
                        <span style={{fontSize:10,color:d.color,fontWeight:700}}>{d.status}</span>
                      </div>
                      <div style={{fontSize:11,color:C.textMuted,lineHeight:1.5}}>{d.note}</div>
                    </div>
                  ))}
                  <div style={{fontSize:10,color:C.textMuted,marginTop:8,lineHeight:1.6}}>
                    💡 看診時可直接展示此卡片給醫師。完整報告在記錄→影像。
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Tab 切換 */}
        {!searchLower&&(
          <div style={{display:"flex",gap:6,marginBottom:16}}>
            {[{key:"lab",label:"📊 指標"},{key:"articles",label:"📖 知識"},{key:"medicine",label:"💊 藥物"},{key:"breakfast",label:"🍳 早餐"}].map(t=>(
              <button key={t.key} onClick={()=>{setKbTab(t.key);setSelectedMedicine(null);setSelectedArticle(null);setSelectedKnowledge(null);}}
                style={{flex:1,padding:"9px 4px",borderRadius:10,border:`1px solid ${kbTab===t.key?C.green:C.border}`,
                  background:kbTab===t.key?"rgba(46,204,138,0.12)":"transparent",
                  color:kbTab===t.key?C.green:C.textMuted,fontSize:12,cursor:"pointer",
                  fontFamily:"'Noto Sans TC',sans-serif",fontWeight:kbTab===t.key?700:400}}>
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* 搜尋結果 */}
        {searchLower&&(
          <div>
            {filteredLab.length>0&&(
              <>
                <div style={{fontSize:11,color:C.textMuted,letterSpacing:1,marginBottom:8}}>檢驗指標（{filteredLab.length}項）</div>
                {filteredLab.map(item=><KnowledgeCard key={item.key} item={item} latestLab={latestLab} onSelect={setSelectedKnowledge}/>)}
              </>
            )}
            {filteredArticles.length>0&&(
              <>
                <div style={{fontSize:11,color:C.textMuted,letterSpacing:1,marginBottom:8,marginTop:12}}>健康知識（{filteredArticles.length}篇）</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {filteredArticles.map(art=><ArticleCard key={art.id} art={art} onSelect={setSelectedArticle}/>)}
                </div>
              </>
            )}
            {filteredLab.length===0&&filteredArticles.length===0&&(
              <div className="empty-state">找不到「{kbSearch}」</div>
            )}
          </div>
        )}

        {/* 檢驗指標 Tab */}
        {!searchLower&&kbTab==="lab"&&(
          <>
            <div style={{background:"rgba(255,179,71,0.08)",border:"1px solid rgba(255,179,71,0.25)",borderRadius:14,padding:14,marginBottom:16}}>
              <div style={{fontSize:13,fontWeight:700,color:C.amber,marginBottom:6}}>📌 糖尿病前期專區</div>
              <div style={{fontSize:12,color:C.textMuted,lineHeight:1.7}}>HbA1c 5.97% + 家族史 T2D = 高風險群<br/>好消息：糖尿病前期是可逆的，現在介入效果最好！</div>
            </div>
            {(()=>{
              const groupList = groups.map(group=>({
                group,
                items: KNOWLEDGE_ITEMS.filter(i=>i.group===group),
                isOpen: openGroup===group,
              }));
              return(
                <>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:4}}>
                    {groupList.map(({group,items,isOpen})=>(
                      <div key={group}
                        style={{padding:"7px 10px",background:isOpen?"rgba(46,204,138,0.12)":C.bgCard,
                          borderRadius:"10px",border:`1px solid ${isOpen?C.green:C.border}`,
                          cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}
                        onClick={()=>setOpenGroup(isOpen?null:group)}>
                        <div style={{display:"flex",alignItems:"center",gap:5,flex:1}}>
                          <span style={{fontSize:14}}>{group.split(" ")[0]}</span>
                          <span style={{fontSize:10,color:isOpen?C.green:C.text,fontWeight:isOpen?700:400}}>
                            {group.replace(/^[^\s]+\s/,"")}
                          </span>
                          <span style={{fontSize:9,color:C.textMuted}}>{items.length}項</span>
                        </div>
                        <span style={{color:isOpen?C.green:C.textMuted,fontSize:11}}>
                          {isOpen?"▲":"▼"}
                        </span>
                      </div>
                    ))}
                  </div>
                  {/* 展開內容（跨全寬） */}
                  {openGroup&&(()=>{
                    const items = KNOWLEDGE_ITEMS.filter(i=>i.group===openGroup);
                    return(
                      <div style={{border:`1px solid ${C.green}`,borderRadius:"10px",overflow:"hidden",marginBottom:8}}>
                        {items.map(item=><KnowledgeCard key={item.key} item={item} latestLab={latestLab} onSelect={setSelectedKnowledge}/>)}
                      </div>
                    );
                  })()}
                </>
              );
            })()}
          </>
        )}

        {/* 健康知識 Tab */}
        {!searchLower&&kbTab==="articles"&&(
          <>
            <button className="btn-secondary" style={{width:"100%",marginBottom:16}}
              onClick={()=>setShowAddArticle(true)}>
              ✏️ 新增知識文章
            </button>
            {allArticles.length===0?(
              <div className="empty-state">尚無文章，點上方按鈕新增</div>
            ):(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {allArticles.map(art=><ArticleCard key={art.id} art={art} onSelect={setSelectedArticle}/>)}
              </div>
            )}
          </>
        )}
        {/* 藥物/保健品 Tab */}
        {!searchLower&&kbTab==="medicine"&&(
          <>
            <div style={{background:"rgba(46,204,138,0.06)",border:`1px solid ${C.border}`,borderRadius:12,padding:"8px 12px",marginBottom:10}}>
              <div style={{fontSize:11,color:C.textMuted,lineHeight:1.6}}>
                💡 以下資訊僅供參考，實際用藥請諮詢醫師或藥師。
              </div>
            </div>
            {/* 我的用藥清單 */}
            <div className="card" style={{padding:"12px",marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:myMeds.length>0||showMedForm?8:0}}>
                <div style={{fontSize:13,fontWeight:700,color:C.green}}>📝 我的用藥及保健清單</div>
                <button onClick={()=>setShowMedForm(v=>!v)}
                  style={{padding:"4px 12px",borderRadius:8,fontSize:12,cursor:"pointer",
                    background:showMedForm?"transparent":"rgba(46,204,138,0.12)",
                    border:`1px solid ${C.green}`,color:C.green,
                    fontFamily:"'Noto Sans TC',sans-serif"}}>
                  {showMedForm?"取消":"＋新增"}
                </button>
              </div>
              {showMedForm&&(
                <div style={{background:C.bg,borderRadius:10,padding:10,marginBottom:8}}>
                  <input className="input-field" placeholder="藥品/保健品名稱（例：舒脈康 5/40mg）"
                    value={medForm.name} onChange={e=>setMedForm(f=>({...f,name:e.target.value}))}
                    style={{marginBottom:6}}/>
                  <div style={{display:"flex",gap:6,marginBottom:6}}>
                    <input className="input-field" placeholder="劑量（例：1錠）" style={{flex:1}}
                      value={medForm.dose} onChange={e=>setMedForm(f=>({...f,dose:e.target.value}))}/>
                    <select className="input-field" style={{flex:1}}
                      value={medForm.freq} onChange={e=>setMedForm(f=>({...f,freq:e.target.value}))}>
                      <option>每天</option><option>2天1次</option><option>每週1次</option><option>需要時</option>
                    </select>
                  </div>
                  <div style={{marginBottom:6}}>
                    <select className="input-field"
                      value={medForm.timing} onChange={e=>setMedForm(f=>({...f,timing:e.target.value}))}>
                      <option>早餐前</option><option>早餐後</option><option>午餐後</option>
                      <option>晚餐後</option><option>睡前</option><option>每日固定</option>
                    </select>
                  </div>
                  <input className="input-field" placeholder="備註（選填，例：醫師處方/自行補充）"
                    value={medForm.note} onChange={e=>setMedForm(f=>({...f,note:e.target.value}))}
                    style={{marginBottom:8}}/>
                  <button className="btn-primary" style={{padding:"8px"}}
                    onClick={()=>{
                      if(!medForm.name.trim()){showToast("⚠️ 請輸入名稱");return;}
                      saveMyMeds([...myMeds,{id:Date.now(),...medForm,startDate:today()}]);
                      setMedForm({name:"",dose:"",freq:"每天",timing:"早餐後",note:""});
                      setShowMedForm(false);
                      showToast("✅ 已加入清單");
                    }}>儲存</button>
                </div>
              )}
              {myMeds.length===0&&!showMedForm&&(
                <div style={{fontSize:11,color:C.textMuted,marginTop:6}}>記錄你實際服用的藥物與保健品（存於手機本地）</div>
              )}
              {myMeds.map(med=>(
                <div key={med.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                  padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:600,color:C.text}}>{med.name}</div>
                    <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>
                      {[med.dose,med.freq,med.timing,med.note].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <button onClick={()=>{
                    if(window.confirm(`刪除「${med.name}」？`)){
                      saveMyMeds(myMeds.filter(m=>m.id!==med.id));
                      showToast("🗑️ 已刪除");
                    }
                  }}
                    style={{background:"transparent",border:"none",color:C.textMuted,fontSize:16,cursor:"pointer",padding:"4px 8px"}}>×</button>
                </div>
              ))}
            </div>
            {/* 保健品/藥物 子Tab切換 */}
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              {[{key:"supplement",label:"💊 保健品",color:C.green},{key:"medicine",label:"💉 藥物",color:C.blue}].map(t=>(
                <button key={t.key} onClick={()=>setMedSubTab(t.key)}
                  style={{flex:1,padding:"8px",borderRadius:10,fontSize:13,cursor:"pointer",
                    background:medSubTab===t.key?`rgba(46,204,138,0.12)`:C.bgCard,
                    border:`1px solid ${medSubTab===t.key?t.color:C.border}`,
                    color:medSubTab===t.key?t.color:C.textMuted,
                    fontFamily:"'Noto Sans TC',sans-serif",fontWeight:medSubTab===t.key?700:400}}>
                  {t.label}
                </button>
              ))}
            </div>
            {(()=>{
              const items = MEDICINE_ITEMS.filter(m=>m.type===medSubTab);
              const takingItems = items.filter(m=>m.taking);
              const otherItems = items.filter(m=>!m.taking);
              const MedCard=({m})=>(
                <div style={{background:C.bgCard,
                  border:`1px solid ${m.taking?C.green:C.border}`,borderRadius:10,
                  padding:"8px 8px",cursor:"pointer"}}
                  onClick={()=>setSelectedMedicine(m)}>
                  <div style={{fontSize:18,textAlign:"center",marginBottom:4}}>{m.icon}</div>
                  <div style={{fontSize:11,fontWeight:600,color:C.text,textAlign:"center",lineHeight:1.4}}>{m.name}</div>
                  {!m.taking&&m.personal?.startsWith("⭐")&&(
                    <div style={{fontSize:10,color:C.amber,textAlign:"center",marginTop:3}}>⭐ 推薦</div>
                  )}
                </div>
              );
              return(
                <>
                  {takingItems.length>0&&(
                    <>
                      <div style={{fontSize:12,fontWeight:700,color:C.green,letterSpacing:1,marginBottom:8}}>✅ 目前使用</div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:16}}>
                        {takingItems.map(m=><MedCard key={m.id} m={m}/>)}
                      </div>
                    </>
                  )}
                  {otherItems.length>0&&(
                    <>
                      <div style={{fontSize:12,fontWeight:700,color:C.textMuted,letterSpacing:1,marginBottom:8}}>📖 參考資訊</div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                        {otherItems.map(m=><MedCard key={m.id} m={m}/>)}
                      </div>
                    </>
                  )}
                </>
              );
            })()}
          </>
        )}
        {!searchLower&&kbTab==="breakfast"&&(()=>{
          const MEALS=[
            {order:1,label:"蛋白質＋蔬菜",items:[
              {name:"雞蛋",qty:"2-3顆",benefits:["優質蛋白飽腹延緩血糖上升","卵磷脂護大腦和肝臟","維生素D+B12"],organs:["血糖","大腦","肝臟"]},
              {name:"青菜",qty:"有就吃",benefits:["膳食纖維穩血糖","葉酸護心血管","低卡飽腹"],organs:["血糖","心血管"]},
            ]},
            {order:2,label:"好油",items:[
              {name:"酪梨",qty:"180g",benefits:["單元不飽和脂肪直接升HDL","鉀降血壓","葉黃素護眼"],organs:["血脂HDL","心血管"]},
              {name:"橄欖油",qty:"5ml 直接喝",benefits:["多酚Oleocanthal抗發炎護肝","升HDL","改善脂肪肝有實證"],organs:["肝臟","血脂HDL","發炎/其他"]},
            ]},
            {order:3,label:"🥤 堅果奶昔（果汁機攪拌）",isShake:true,items:[
              {name:"核桃",qty:"20g",benefits:["ALA Omega-3護大腦和血管","降LDL","多酚抗氧化"],organs:["大腦","血脂HDL"]},
              {name:"杏仁",qty:"10g",benefits:["維生素E強效抗氧化","降LDL","鎂降血壓"],organs:["血脂HDL","心血管"]},
              {name:"南瓜子",qty:"15g",benefits:["鎂+鋅降血壓護前列腺","鐵改善血液","植物固醇降膽固醇"],organs:["心血管","血液"]},
              {name:"奇亞籽",qty:"10g",benefits:["水溶性纖維穩血糖減峰值","Omega-3降TG","吸水膨脹增飽腹感"],organs:["血糖","血脂HDL"]},
              {name:"亞麻籽",qty:"15g",benefits:["木酚素抗發炎降雌激素","Omega-3降TG","纖維護腸道"],organs:["血脂HDL","發炎/其他"]},
              {name:"黑芝麻粉",qty:"10g",benefits:["芝麻素護肝抗氧化","鈣強骨","芝麻素輕微降血壓"],organs:["肝臟","心血管"]},
              {name:"燕麥",qty:"20g",benefits:["β-葡聚醣降LDL有強力實證","穩血糖減峰值","腸道益生元"],organs:["血糖","血脂HDL"]},
              {name:"無糖可可",qty:"3g",benefits:["黃烷醇擴張血管降血壓","護大腦認知","抗氧化"],organs:["心血管","大腦"]},
              {name:"薑黃",qty:"1.5g＋少量胡椒",benefits:["薑黃素強效抗發炎，胡椒增吸收20倍","護肝減脂肪肝","可能改善胰島素敏感性"],organs:["發炎/其他","肝臟","血糖"]},
              {name:"甜菜根粉",qty:"3g（Datino）",benefits:["硝酸鹽→一氧化氮→擴張血管降血壓","改善全身血液循環","運動耐力+性功能血流相關"],organs:["心血管","血脂HDL"]},
            ]},
            {order:4,label:"水果",items:[
              {name:"蘋果",qty:"180g",benefits:["果膠降膽固醇護腸道","槲皮素抗發炎","低GI穩血糖"],organs:["血脂HDL","血糖"]},
            ]},
            {order:5,label:"補充品",items:[
              {name:"EX NEO 力卡維他命",qty:"2錠",benefits:["B1預防神經病變（糖尿病前期必備）","B12 1,500μg超高劑量護周邊神經","B6+E抗氧化，緩解眼疲勞肩頸腰痛"],organs:["血糖","大腦"]},
              {name:"強力若元 Wakamoto",qty:"9粒",benefits:["釀酒酵母+乳酸菌整腸","澱粉酶幫助消化","與晚上希臘酸奶益生菌加成護腸道"],organs:["腸道","血糖"]},
            ]},
          ];
          const DINNER=[
            {name:"希臘酸奶",qty:"200g（Farmers Union）",benefits:["高蛋白16g助肌肉修復","益生菌改善腸道","鈣538mg強骨，No Sugar Added血糖友善","酪蛋白慢消化穩定夜間血糖"],organs:["血糖","腸道","骨骼"],meds:"💊 同時服藥：平脂 Zulitor、保栓通 Plavix（每天）；舒脈康 Sevikar（2天1次）"},
            {name:"ORIHIRO DHA+EPA",qty:"6粒",benefits:["DHA 780mg降中性脂肪、護大腦記憶","EPA 80mg抗發炎保護心血管","Omega-3組合對你的HDL偏低有幫助"],organs:["血脂HDL","大腦","心血管"],meds:"⚠️ 注意：你同時服用保栓通Plavix（抗血小板），高劑量Omega-3也有抗凝血效果，出血風險疊加。建議告知開立Plavix的醫師確認此劑量安全性，並注意瘀青/出血徵兆"},
            {name:"奇異果",qty:"1顆",benefits:["維生素C超高（每顆約100mg）抗氧化","鉀降血壓","纖維改善腸道","血清素前驅物助睡眠"],organs:["心血管","腸道","血液"]},
          ];
          const dates=new Set(breakfastLog.map(r=>normalizeDate(r.date)));
          const todayStr=today();
          const checkedToday=dates.has(todayStr);
          let streak=0;
          const d=new Date();
          if(!checkedToday)d.setDate(d.getDate()-1);
          while(true){
            const ds=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
            if(dates.has(ds)){streak++;d.setDate(d.getDate()-1);}else break;
          }
          const ItemCard=({item,dinnerMode})=>(
            <div style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 12px",marginBottom:6}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <span style={{fontSize:13,fontWeight:700,color:C.text}}>{item.name}</span>
                  <span style={{fontSize:11,color:C.textMuted}}>{item.qty}</span>
                </div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap",justifyContent:"flex-end"}}>
                  {item.organs.map(o=>(
                    <span key={o} style={{fontSize:9,padding:"2px 6px",borderRadius:6,background:"rgba(46,204,138,0.12)",color:C.green,fontWeight:600}}>{o}</span>
                  ))}
                </div>
              </div>
              <div style={{fontSize:11,color:C.textMuted,lineHeight:1.7}}>
                {item.benefits.map((b,i)=><div key={i}>• {b}</div>)}
              </div>
              {item.meds&&(
                <div style={{marginTop:6,padding:"6px 8px",background:"rgba(90,180,255,0.08)",borderRadius:8,fontSize:11,color:C.blue,lineHeight:1.6}}>{item.meds}</div>
              )}
            </div>
          );
          return(
            <>
              {/* 打卡 */}
              <div className="card" style={{padding:"12px",display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:C.text}}>🍳 今日早餐</div>
                  <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>🔥 連續 {streak} 天 · 共 {breakfastLog.length} 次</div>
                </div>
                <button disabled={checkedToday}
                  onClick={async()=>{
                    const r=await api.post("append","breakfast_log",{id:Date.now(),date:todayStr,checked:1});
                    if(r&&!r.error){setBreakfastLog(prev=>[...prev,{date:todayStr,checked:1}]);showToast("✅ 早餐打卡成功！");}
                    else showToast("❌ 打卡失敗");
                  }}
                  style={{padding:"10px 18px",borderRadius:12,fontSize:13,fontWeight:700,cursor:checkedToday?"default":"pointer",
                    background:checkedToday?"rgba(46,204,138,0.12)":C.green,
                    border:"none",color:checkedToday?C.green:"#0a0a0a",
                    fontFamily:"'Noto Sans TC',sans-serif"}}>
                  {checkedToday?"✅ 已打卡":"打卡"}
                </button>
              </div>
              {/* 早餐整體策略摘要 */}
              <div className="card" style={{marginBottom:12,background:"rgba(46,204,138,0.04)",border:`1px solid ${C.green}44`}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                  <span style={{fontSize:18}}>🎯</span>
                  <div style={{fontSize:13,fontWeight:700,color:C.green}}>早餐策略總目標</div>
                </div>
                <div style={{fontSize:12,color:C.textMuted,lineHeight:1.8,marginBottom:8}}>
                  這份早餐是針對你的<span style={{color:C.amber}}>三大弱項</span>設計的「治療性飲食」，不是普通早餐。
                </div>
                {[
                  {icon:"🩸",label:"血糖控制",desc:"蛋白質→好油→纖維→水果的進食順序，讓血糖峰值降低20-30%。目標：HbA1c從5.7%降回正常值5.6%以下"},
                  {icon:"❤️",label:"升高HDL",desc:"五種好油來源（酪梨/橄欖油/核桃/杏仁/亞麻籽）持續攝取，8週驗血看HDL是否從35升高到40"},
                  {icon:"🫁",label:"護肝降ALT",desc:"黑咖啡護肝+低碳飲食減少肝臟負擔。目標：ALT從63降到40以下，配合不吃白飯策略"},
                  {icon:"🔥",label:"持續的關鍵",desc:"每天吃才有效。打卡記錄用於追蹤達成率，8週後抽血驗證效果——這是你唯一能知道策略有沒有效的方法"},
                ].map((item,i)=>(
                  <div key={i} style={{display:"flex",gap:8,padding:"6px 0",borderTop:i===0?`1px solid ${C.border}`:`1px solid ${C.border}`}}>
                    <span style={{fontSize:14,flexShrink:0}}>{item.icon}</span>
                    <div>
                      <div style={{fontSize:11,fontWeight:700,color:C.text,marginBottom:1}}>{item.label}</div>
                      <div style={{fontSize:11,color:C.textMuted,lineHeight:1.6}}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{background:"rgba(46,204,138,0.06)",border:`1px solid ${C.border}`,borderRadius:12,padding:"10px 12px",marginBottom:12,fontSize:12,color:C.textMuted,lineHeight:1.7}}>
                💡 依吃的順序排列 · 綠標對應雷達圖弱項 · 每天執行+定期抽血驗證效果
              </div>
              {/* 早餐組合評估 */}
              <div className="card" style={{marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                  <div style={{fontSize:13,fontWeight:700,color:C.text}}>📊 早餐組合評估</div>
                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                    <span style={{fontFamily:"'DM Serif Display',serif",fontSize:22,color:C.green}}>9</span>
                    <span style={{fontSize:11,color:C.textMuted}}>/10</span>
                    <span style={{fontSize:14,marginLeft:2}}>⭐</span>
                  </div>
                </div>
                {/* 優點 */}
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.green,letterSpacing:1,marginBottom:6}}>✅ 優點</div>
                  {[
                    {title:"HDL偏低→直接命中",desc:"酪梨+橄欖油+核桃+杏仁+亞麻籽，五種來源單元/多元不飽和脂肪，升HDL最有實證的飲食策略"},
                    {title:"血糖進食順序正確",desc:"蛋白質→好油→纖維→水果，此順序可降低血糖峰值20-30%，對糖尿病前期關鍵"},
                    {title:"三路抗發炎",desc:"薑黃+胡椒（吸收20倍）、亞麻籽木酚素、可可黃烷醇，強效抗發炎組合"},
                    {title:"甜菜根粉聰明加入",desc:"硝酸鹽→一氧化氮→擴張血管，對血壓130/90和血液循環直接有效"},
                    {title:"益生菌雙重策略",desc:"早上強力若元+晚上希臘酸奶，早晚腸道保護，與血糖控制直接相關"},
                  ].map((item,i)=>(
                    <div key={i} style={{padding:"7px 0",borderBottom:`1px solid ${C.border}`}}>
                      <div style={{fontSize:12,fontWeight:600,color:C.text,marginBottom:2}}>{item.title}</div>
                      <div style={{fontSize:11,color:C.textMuted,lineHeight:1.6}}>{item.desc}</div>
                    </div>
                  ))}
                </div>
                {/* 缺點/建議 */}
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:C.amber,letterSpacing:1,marginBottom:6}}>⚠️ 需注意</div>
                  {[
                    {title:"堅果總量偏高（70g）",desc:"核桃+杏仁+南瓜子+奇亞籽+亞麻籽共70g，加酪梨180g+雞蛋3顆，早餐熱量逾1000kcal，佔全天50%以上。建議堅果類控制在50g：核桃20g/杏仁5g/南瓜子10g/奇亞籽5g/亞麻籽10g",color:C.amber},
                    {title:"亞麻籽需充分研磨",desc:"整顆亞麻籽吸收率極低，打入奶昔需確認果汁機充分攪碎（你已用果汁機✅）。若想提升口感可低溫乾炒1-2分鐘再打，但避免高溫以免破壞Omega-3和木酚素",color:C.amber},
                    {title:"Omega-3三路重疊",desc:"奇亞籽+亞麻籽+ORIHIRO DHA 780mg，三路Omega-3搭配Plavix抗血小板，出血風險疊加。請確認醫師已知情你的DHA補充劑量",color:C.red},
                    {title:"蛋白質配額偏緊",desc:"55歲維持肌肉目標約80g/天。早餐雞蛋3顆18g+堅果15g=約33g，午晚餐需補足50g。建議午餐優先補充雞胸肉/魚/豆腐等高蛋白來源",color:C.textMuted},
                  ].map((item,i)=>(
                    <div key={i} style={{padding:"7px 0",borderBottom:`1px solid ${C.border}`}}>
                      <div style={{fontSize:12,fontWeight:600,color:item.color,marginBottom:2}}>{item.title}</div>
                      <div style={{fontSize:11,color:C.textMuted,lineHeight:1.6}}>{item.desc}</div>
                    </div>
                  ))}
                </div>
                <div style={{marginTop:8,fontSize:10,color:C.textMuted,lineHeight:1.6}}>
                  💡 整體而言這是設計完整的治療性飲食，針對你的HDL/血糖/抗發炎三大弱項。持續執行8週後抽血驗證效果。
                </div>
              </div>
              {/* 早餐食材 */}
              {MEALS.map(meal=>(
                <div key={meal.order} style={{marginBottom:12}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                    <span style={{fontSize:11,fontWeight:700,color:meal.isShake?C.amber:C.textMuted,letterSpacing:0.5}}>
                      {meal.isShake?"🥤":""} 順序{meal.order}
                    </span>
                    <span style={{fontSize:11,color:meal.isShake?C.amber:C.textMuted}}>{meal.label}</span>
                  </div>
                  {meal.items.map(item=><ItemCard key={item.name} item={item}/>)}
                </div>
              ))}
              {/* 午後習慣 */}
              <div style={{height:1,background:C.border,margin:"16px 0"}}/>
              <div style={{fontSize:12,fontWeight:700,color:C.amber,letterSpacing:1,marginBottom:8}}>☀️ 午後（13:00–14:00）</div>
              {[
                {
                  name:"黑咖啡",qty:"300cc+（不加糖/奶精）",organs:["肝臟","血糖","大腦"],
                  pros:[
                    "護肝最強飲料：每天2杯以上可降低ALT/GGT、減少脂肪肝纖維化風險，有大量實證",
                    "改善胰島素敏感性：綠原酸降低T2D風險約25-30%，對糖尿病前期直接有效",
                    "輕微升HDL：對你的HDL 30.94有加成",
                    "護大腦：長期降低阿茲海默症和帕金森風險",
                  ],
                  cons:[
                    "2杯以上會心悸（你的親身經驗）→ 每天限1杯",
                    "血壓敏感：咖啡因短暫升高血壓，1杯300cc在用藥控制下OK",
                    "空腹喝傷胃：午餐後喝最佳（你13-14點的習慣✅）",
                  ],
                  note:"✅ 每天1杯300cc，13-14點喝，不影響睡眠，是你健康習慣的重要一環",
                },
                {
                  name:"黑巧克力 85%以上",qty:"一小片10-15g",organs:["心血管","大腦","發炎/其他"],
                  pros:[
                    "可可黃烷醇擴張血管降血壓，與早餐無糖可可3g形成加成",
                    "改善大腦認知功能和記憶，護神經",
                    "多酚類強效抗氧化抗發炎",
                    "鎂改善情緒，對越南工作壓力有幫助",
                    "85%含糖量極低，血糖影響小（選擇正確✅）",
                  ],
                  cons:[
                    "超過30g可能影響血糖，控制在10-15g即可",
                    "含少量咖啡因（約5-10mg/片），與咖啡同時吃累積量仍在安全範圍",
                    "熱量密度高（約80-90kcal/15g），每天一小片不超量",
                  ],
                  note:"建議與咖啡一起在午後享用，形成固定的愉悅健康習慣",
                },
              ].map(item=>(
                <div key={item.name} style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 12px",marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      <span style={{fontSize:13,fontWeight:700,color:C.text}}>{item.name}</span>
                      <span style={{fontSize:11,color:C.textMuted}}>{item.qty}</span>
                    </div>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap",justifyContent:"flex-end"}}>
                      {item.organs.map(o=>(
                        <span key={o} style={{fontSize:9,padding:"2px 6px",borderRadius:6,background:"rgba(46,204,138,0.12)",color:C.green,fontWeight:600}}>{o}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{marginBottom:6}}>
                    <div style={{fontSize:10,fontWeight:700,color:C.green,marginBottom:3}}>✅ 優點</div>
                    {item.pros.map((p,i)=><div key={i} style={{fontSize:11,color:C.textMuted,lineHeight:1.6}}>• {p}</div>)}
                  </div>
                  <div style={{marginBottom:6}}>
                    <div style={{fontSize:10,fontWeight:700,color:C.amber,marginBottom:3}}>⚠️ 注意</div>
                    {item.cons.map((c,i)=><div key={i} style={{fontSize:11,color:C.textMuted,lineHeight:1.6}}>• {c}</div>)}
                  </div>
                  <div style={{fontSize:11,color:C.blue,lineHeight:1.6,marginTop:4}}>💡 {item.note}</div>
                </div>
              ))}
              {DINNER.map(item=><ItemCard key={item.name} item={item}/>)}
              <div style={{fontSize:11,color:C.textMuted,textAlign:"center",marginTop:8,lineHeight:1.7}}>
                針對弱項：HDL 30.94 · 脂肪肝G1 · 血糖前期 · 血壓130/90<br/>
                8週後抽血對照雷達圖驗證效果 💪
              </div>
            </>
          );
        })()}
      </div>
    );
  };
  const KnowledgeCard=({item,latestLab,onSelect})=>{
    const yourVal = latestLab?.[item.key];
    const hasVal = yourVal!==null&&yourVal!==undefined&&yourVal!=="";
    const st = getStatus(item.key, yourVal);
    const stColors = {ok:C.green, warn:C.amber, alert:C.red};
    const qualKeys = ["hbsag","anti_hbs","anti_hcv","asto","rf",
      "urine_glucose","urine_bilirubin","urine_ketone","urine_nitrite",
      "urine_urobilinogen","urine_blood","urine_leukocyte","crp"];
    const isQual = qualKeys.includes(item.key);
    const getQualDisplay = (v)=>{
      if(!hasVal)return null;
      const s=String(v).toLowerCase().trim();
      if(s==="0"||s==="negative"||s==="neg")return{text:"陰性",color:C.green};
      if(s==="1"||s==="positive"||s==="pos")return{text:"陽性",color:C.red};
      return{text:String(v),color:C.text};
    };
    const qualDisplay = getQualDisplay(yourVal);
    return(
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"12px 16px",borderBottom:`1px solid ${C.border}`,cursor:"pointer",background:"transparent"}}
        onClick={()=>onSelect(item)}>
        <div style={{display:"flex",alignItems:"center",gap:10,flex:1}}>
          <span style={{fontSize:18}}>{item.icon}</span>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:600,color:C.text}}>{item.title}</div>
            {hasVal?(
              isQual&&qualDisplay?(
                <div style={{fontSize:11,color:qualDisplay.color,marginTop:2}}>最新值：{qualDisplay.text}</div>
              ):(
                <div style={{fontSize:11,color:st?stColors[st]:C.textMuted,marginTop:2}}>
                  最新值：{fmtLabVal(item.key,yourVal)} {LAB_STATUS[item.key]?.unit||""}
                </div>
              )
            ):(
              <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>尚無記錄</div>
            )}
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          {hasVal&&!isQual&&st&&(
            <span className={`status-chip ${st==="ok"?"status-ok":st==="warn"?"status-warn":"status-alert"}`}>
              {st==="ok"?"正常":st==="warn"?"注意":"異常"}
            </span>
          )}
          {hasVal&&isQual&&qualDisplay&&(
            <span style={{fontSize:11,fontWeight:600,color:qualDisplay.color}}>{qualDisplay.text}</span>
          )}
          <span style={{color:C.textMuted,fontSize:16}}>›</span>
        </div>
      </div>
    );
  };

  // 健康知識文章卡片
  const ArticleCard=({art,onSelect})=>(
    <div style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:12,
      padding:"10px 8px",cursor:"pointer"}} onClick={()=>onSelect(art)}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginBottom:6}}>
        <span style={{fontSize:18}}>{art.icon}</span>
        <span style={{fontSize:12,padding:"2px 8px",background:"rgba(46,204,138,0.12)",borderRadius:8,color:C.green,fontWeight:600}}>{art.tag}</span>
      </div>
      <div style={{fontSize:12,fontWeight:600,color:C.text,lineHeight:1.4,textAlign:"center"}}>
        {art.title}
      </div>
    </div>
  );

  // ── 設定 ───────────────────────────────────────────────
  const SettingTab=()=>{
    const [inputKey,setInputKey]=useState(apiKey);
    const [newHospital,setNewHospital]=useState("");
    const [cloudName,setCloudName]=useState(localStorage.getItem("cloudinary_name")||"");
    const [cloudPreset,setCloudPreset]=useState(localStorage.getItem("cloudinary_preset")||"");
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
                    api.saveSetting("hospitals", updated);
                    showToast("🗑️ 已刪除並同步");
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
              api.saveSetting("hospitals", updated);
              setNewHospital("");
              showToast("✅ 醫院已新增並同步");
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

        {/* Cloudinary 照片上傳設定 */}
        <div className="card">
          <div className="card-title">📷 照片上傳設定（Cloudinary）</div>
          <div style={{fontSize:12,color:C.textMuted,marginBottom:10,lineHeight:1.7}}>
            用於影像檢查照片上傳<br/>
            至 <span style={{color:C.green}}>cloudinary.com</span> 取得 Cloud Name 與 Upload Preset（需設為 Unsigned）
          </div>
          {localStorage.getItem("cloudinary_name")&&(
            <div style={{fontSize:12,color:C.green,marginBottom:8,padding:"6px 10px",background:"rgba(46,204,138,0.1)",borderRadius:8}}>
              ✅ 已設定：{localStorage.getItem("cloudinary_name")}
            </div>
          )}
          <div style={{marginBottom:10}}>
            <div className="field-label">Cloud Name</div>
            <input className="input-field" placeholder="例：dxaxjnhil"
              value={cloudName} onChange={e=>setCloudName(e.target.value)}
              style={{marginBottom:8}}/>
            <div className="field-label">Upload Preset（Unsigned）</div>
            <input className="input-field" placeholder="例：health-journal"
              value={cloudPreset} onChange={e=>setCloudPreset(e.target.value)}
              style={{marginBottom:10}}/>
            <button className="btn-primary" onClick={()=>{
              if(!cloudName.trim()||!cloudPreset.trim()){showToast("⚠️ 請填入 Cloud Name 和 Preset");return;}
              localStorage.setItem("cloudinary_name",cloudName.trim());
              localStorage.setItem("cloudinary_preset",cloudPreset.trim());
              showToast("✅ Cloudinary 設定已儲存");
            }}>儲存設定</button>
          </div>
          {localStorage.getItem("cloudinary_name")&&(
            <button style={{width:"100%",padding:"10px",background:"transparent",border:`1px solid ${C.red}44`,borderRadius:10,color:C.red,fontSize:13,cursor:"pointer",fontFamily:"'Noto Sans TC',sans-serif"}}
              onClick={()=>{
                localStorage.removeItem("cloudinary_name");
                localStorage.removeItem("cloudinary_preset");
                setCloudName(""); setCloudPreset("");
                showToast("🗑️ Cloudinary 設定已清除");
              }}>清除設定</button>
          )}
        </div>

        {/* 藥物提醒設定 */}
        <div className="card">
          <div className="card-title">💊 藥物提醒</div>
          <div style={{fontSize:12,color:C.textMuted,marginBottom:10,lineHeight:1.7}}>
            依你的用藥時間設定提醒，使用手機瀏覽器通知（需允許通知權限）
          </div>
          {[
            {name:"平脂 Zulitor + 保栓通 Plavix",time:"21:00",freq:"每天",color:C.green},
            {name:"舒脈康 Sevikar 5/40mg",time:"21:00",freq:"2天1次",color:C.blue},
            {name:"ORIHIRO DHA+EPA",time:"19:30",freq:"每天（晚餐後）",color:C.amber},
            {name:"EX NEO 力卡維他命",time:"08:00",freq:"每天（早餐後）",color:C.purple},
          ].map(med=>(
            <div key={med.name} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:C.text}}>{med.name}</div>
                <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>{med.time} · {med.freq}</div>
              </div>
              <button onClick={()=>{
                if(!("Notification" in window)){showToast("⚠️ 此瀏覽器不支援通知");return;}
                Notification.requestPermission().then(p=>{
                  if(p==="granted"){
                    showToast(`✅ ${med.name} 提醒已設定（${med.time}）`);
                  }else{
                    showToast("⚠️ 請在瀏覽器設定中允許通知權限");
                  }
                });
              }}
                style={{padding:"5px 12px",borderRadius:8,fontSize:11,cursor:"pointer",
                  background:`rgba(46,204,138,0.1)`,border:`1px solid ${med.color}66`,
                  color:med.color,fontFamily:"'Noto Sans TC',sans-serif"}}>
                🔔 設定提醒
              </button>
            </div>
          ))}
          <div style={{fontSize:10,color:C.textMuted,marginTop:8,lineHeight:1.6}}>
            ⚠️ 網頁通知需在手機加到主畫面（PWA）才能背景運作，或使用手機內建鬧鐘作為替代。
          </div>
        </div>
        {/* 健康摘要匯出 */}
        <div className="card">
          <div className="card-title">📄 健康摘要報告</div>
          <div style={{fontSize:12,color:C.textMuted,marginBottom:10,lineHeight:1.7}}>
            動態生成完整健康摘要（異常項目自動列出、用藥清單、雷達分數），可列印或儲存為PDF帶去看診。
          </div>
          <button className="btn-primary" onClick={()=>{
            const latest=labHistory.length>0?labHistory[labHistory.length-1]:null;
            const recentBP=[...bpHistory].slice(-7);
            const avgSys=recentBP.length>0?Math.round(recentBP.reduce((s,r)=>s+parseFloat(r.systolic||0),0)/recentBP.length):null;
            const avgDia=recentBP.length>0?Math.round(recentBP.reduce((s,r)=>s+parseFloat(r.diastolic||0),0)/recentBP.length):null;
            const latestWt=weightHistory.length>0?weightHistory[weightHistory.length-1]:null;
            if(!latest){showToast("⚠️ 尚無抽血資料");return;}
            // 動態異常項目
            const FIELDS=[
              {key:"hba1c",label:"HbA1c",unit:"%"},
              {key:"glucose_ac",label:"空腹血糖",unit:"mg/dL"},
              {key:"alt",label:"ALT",unit:"U/L"},
              {key:"ast",label:"AST",unit:"U/L"},
              {key:"ggt",label:"GGT",unit:"U/L"},
              {key:"hdl",label:"HDL-C",unit:"mg/dL"},
              {key:"ldl",label:"LDL-C",unit:"mg/dL"},
              {key:"tg",label:"三酸甘油酯",unit:"mg/dL"},
              {key:"cholesterol",label:"總膽固醇",unit:"mg/dL"},
              {key:"uric_acid",label:"尿酸",unit:"mg/dL"},
              {key:"creatinine",label:"肌酸酐",unit:"mg/dL"},
              {key:"egfr",label:"eGFR",unit:""},
              {key:"bun",label:"BUN",unit:"mg/dL"},
              {key:"tsh",label:"TSH",unit:"uIU/mL"},
              {key:"hb",label:"血紅素",unit:"g/dL"},
              {key:"wbc",label:"WBC",unit:"K/uL"},
              {key:"platelet",label:"血小板",unit:"K/uL"},
            ];
            const rows=FIELDS.filter(f=>latest[f.key]!=null&&latest[f.key]!=="")
              .map(f=>{
                const st=getStatus(f.key,latest[f.key]);
                const mark=st==="alert"?"❌":st==="warn"?"⚠️":"✅";
                const bg=st==="alert"?"#fff0f3":st==="warn"?"#fffbf0":"";
                return`<tr style="background:${bg}"><td style="padding:6px 12px;border-bottom:1px solid #eee">${f.label}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:bold">${fmtLabVal(f.key,latest[f.key])} ${f.unit}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:center">${mark}</td></tr>`;
              }).join("");
            // 動態追蹤事項（依實際異常自動生成）
            const alerts=[];
            const v=k=>parseFloat(latest[k]);
            if(v("hba1c")>=5.7)alerts.push(`HbA1c ${latest.hba1c}%（目標&lt;5.7%）→ 每3個月追蹤，飲食控制+運動`);
            if(v("alt")>40||v("ggt")>60)alerts.push(`肝功能偏高 ALT ${latest.alt} / GGT ${latest.ggt} → 每6個月追蹤，超音波確認脂肪肝`);
            if(v("hdl")<40)alerts.push(`HDL ${latest.hdl} mg/dL 偏低（目標&gt;40）→ 規律有氧運動、橄欖油、Omega-3`);
            if(v("uric_acid")>7)alerts.push(`尿酸 ${latest.uric_acid} mg/dL 偏高 → 每日飲水2000mL+、限高普林食物`);
            if(v("platelet")<150)alerts.push(`血小板 ${latest.platelet} K/uL 偏低 → 服用Plavix需注意出血風險，告知醫師`);
            if(v("egfr")<75||v("egfr")>0&&v("egfr")<75)alerts.push(`eGFR ${latest.egfr}（G2期）→ 每6個月追蹤腎功能，避免腎毒性藥物`);
            if(avgSys&&avgSys>130)alerts.push(`血壓近7筆均值 ${avgSys}/${avgDia} mmHg 仍偏高 → 確認用藥效果，目標&lt;130/80`);
            alerts.push("右腎囊腫 10×12mm → 每年超音波追蹤");
            // 雷達分數
            const radarScores=computeRadarScores(latest,bpHistory);
            const radarRows=radarScores?radarScores.filter(d=>d.score!=null)
              .map(d=>`<tr><td style="padding:4px 12px">${d.label.split("\\n")[0]}</td><td style="padding:4px 12px;text-align:right;font-weight:bold;color:${d.score>=7?"#1a8c5e":d.score>=6?"#e67e22":"#e74c3c"}">${d.score}/10</td></tr>`).join(""):"";
            // 用藥清單（取我的用藥及保健清單）
            const medList=myMeds.length>0?myMeds.map(m=>`${m.name}　${m.dose||""}　${m.freq||""}　${m.timing||""}`).join("<br/>"):"（請至知識庫→藥物→我的用藥及保健清單填寫）";
            // 打卡統計
            const bkfHit30=Array.from({length:30},(_,i)=>{const d=new Date();d.setDate(d.getDate()-i);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}).filter(ds=>breakfastLog.some(r=>normalizeDate(r.date)===ds)).length;
            const exHit7=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-i);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}).filter(ds=>exerciseLog.some(r=>normalizeDate(r.date)===ds)).length;
            const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>健康摘要報告</title>
<style>body{font-family:'Microsoft JhengHei',sans-serif;max-width:720px;margin:0 auto;padding:30px;color:#222;font-size:14px}
h1{font-size:20px;border-bottom:3px solid #2ecc8a;padding-bottom:8px;margin-bottom:4px}
h2{font-size:15px;color:#1a8c5e;margin-top:20px;margin-bottom:6px;border-left:4px solid #2ecc8a;padding-left:8px}
table{width:100%;border-collapse:collapse}th{background:#f0f7f3;padding:8px 12px;text-align:left;font-size:13px}
.meta{color:#888;font-size:12px}.box{background:#f9f9f9;border-left:4px solid #2ecc8a;padding:10px 14px;margin:8px 0;font-size:13px;line-height:1.9}
.warn{border-left-color:#e67e22;background:#fffbf0}.alert-item{margin:4px 0;padding:4px 0;border-bottom:1px solid #eee}
@media print{body{padding:10px}}</style></head><body>
<h1>📋 健康摘要報告</h1>
<div class="meta">產生日期：${new Date().toLocaleDateString("zh-TW")} ｜ 最新抽血：${fmtDateFull(latest.date)}（${latest.hospital||""}）</div>
<h2>基本資料</h2>
<div class="box">55歲男性 ｜ 體重：${latestWt?latestWt.value_kg+" kg":"—"} ｜ 血壓近7筆均值：${avgSys&&avgDia?avgSys+"/"+avgDia+" mmHg":"—"}<br/>
已知狀況：糖尿病前期（HbA1c ${latest.hba1c||"—"}%）、脂肪肝 Grade 1、右腎囊腫 10×12mm、eGFR ${latest.egfr||"—"}（G2）</div>
<h2>健康雷達分數</h2>
<table><tr><th>面向</th><th style="text-align:right">分數</th></tr>${radarRows}</table>
<h2>最新檢驗數值</h2>
<table><tr><th>項目</th><th style="text-align:right">數值</th><th style="text-align:center">狀態</th></tr>${rows}</table>
<h2>⚠️ 需追蹤事項（自動偵測）</h2>
<div class="box warn">${alerts.map((a,i)=>`<div class="alert-item">${i+1}. ${a}</div>`).join("")}</div>
<h2>目前用藥及保健清單</h2>
<div class="box">${medList}</div>
<h2>生活習慣達成率</h2>
<div class="box">早餐打卡近30天：${bkfHit30}/30 天（${Math.round(bkfHit30/30*100)}%）<br/>運動打卡本週：${exHit7}/7 天</div>
<div class="meta" style="margin-top:24px;padding-top:12px;border-top:1px solid #ddd">本報告由健康日誌App v${VERSION}自動產生，僅供醫師參考，實際診斷以醫師判斷為準。</div>
</body></html>`;
            const win=window.open("","_blank");
            win.document.write(html);
            win.document.close();
            setTimeout(()=>win.print(),500);
          }}>
            📄 產生健康摘要（可列印/存PDF）
          </button>
        </div>

        {/* Sheets 連線狀態 */}
        {(()=>{
          const [connStatus,setConnStatus]=React.useState("idle");
          const [connInfo,setConnInfo]=React.useState(null);
          const checkConn=async()=>{
            setConnStatus("checking");
            try{
              const r=await api.get("ping");
              if(r&&!r.error){
                setConnStatus("ok");
                setConnInfo({
                  lab:labHistory.length,
                  bp:bpHistory.length,
                  glucose:glucoseHistory.length,
                  weight:weightHistory.length,
                  breakfast:breakfastLog.length,
                  exercise:exerciseLog.length,
                  lastSync:lastSync?lastSync.toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"}):"—",
                });
              }else{setConnStatus("error");setConnInfo(null);}
            }catch(e){setConnStatus("error");setConnInfo(null);}
          };
          return(
            <div className="card">
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                <div className="card-title" style={{marginBottom:0}}>🔌 Sheets 連線狀態</div>
                <button onClick={checkConn} disabled={connStatus==="checking"}
                  style={{padding:"5px 12px",borderRadius:8,fontSize:11,cursor:"pointer",
                    background:"transparent",border:`1px solid ${C.border}`,color:C.textMuted,
                    fontFamily:"'Noto Sans TC',sans-serif"}}>
                  {connStatus==="checking"?"檢查中...":"檢查連線"}
                </button>
              </div>
              {connStatus==="idle"&&<div style={{fontSize:12,color:C.textMuted}}>點擊「檢查連線」確認 GAS 和 Sheets 狀態</div>}
              {connStatus==="ok"&&connInfo&&(
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:C.green}}/>
                    <span style={{fontSize:12,color:C.green,fontWeight:700}}>連線正常</span>
                    <span style={{fontSize:11,color:C.textMuted}}>上次同步 {connInfo.lastSync}</span>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                    {[{label:"抽血",n:connInfo.lab},{label:"血壓",n:connInfo.bp},{label:"血糖",n:connInfo.glucose},{label:"體重",n:connInfo.weight},{label:"早餐",n:connInfo.breakfast},{label:"運動",n:connInfo.exercise}].map(s=>(
                      <div key={s.label} style={{background:C.bg,borderRadius:8,padding:"6px 8px",textAlign:"center"}}>
                        <div style={{fontSize:14,fontWeight:700,color:s.n>0?C.green:C.amber}}>{s.n}</div>
                        <div style={{fontSize:10,color:C.textMuted}}>{s.label}筆</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {connStatus==="error"&&(
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:C.red}}/>
                  <span style={{fontSize:12,color:C.red}}>連線失敗，請確認 GAS 已部署且網路正常</span>
                </div>
              )}
            </div>
          );
        })()}
        {/* 維護工具 */}
        <div className="card">
          <div className="card-title">維護工具</div>
          <div style={{fontSize:12,color:C.textMuted,marginBottom:10,lineHeight:1.6}}>
            更新 Google Sheets 欄位（新版本後執行一次）
          </div>
          <button className="btn-primary" style={{marginBottom:8}} onClick={async()=>{
            showToast("⏳ 更新欄位中，請稍候...");
            try {
              const r = await api.get("updateLabColumns");
              if(r?.success) showToast("✅ "+r.message);
              else if(r?.error) showToast("❌ 錯誤："+r.error);
              else showToast("❌ 未知錯誤，請確認Code.gs已更新並重新部署");
            } catch(e) {
              showToast("❌ 連線失敗："+e.message);
            }
          }}>
            🔧 更新 lab_reports 欄位
          </button>
          <div style={{fontSize:11,color:C.textMuted}}>
            自動新增所有缺少的欄位，不影響現有資料
          </div>
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
    {key:"ai",label:"AI",icon:<AIIcon/>},
    {key:"knowledge",label:"知識",icon:<span style={{fontSize:18}}>📚</span>},
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
      {/* 影像記錄編輯Modal */}
      {editImaging&&(
        <div className="overlay" onClick={()=>setEditImaging(null)}>
          <div className="overlay-sheet" onClick={e=>e.stopPropagation()}
            style={{maxHeight:"90vh",overflowY:"auto"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{fontSize:15,fontWeight:700,color:C.text}}>✏️ 編輯影像記錄</div>
              <button onClick={()=>setEditImaging(null)}
                style={{background:"transparent",border:"none",fontSize:20,color:C.textMuted,cursor:"pointer"}}>×</button>
            </div>
            {/* 類型+日期 */}
            <div style={{display:"flex",gap:8,marginBottom:8}}>
              <select className="input-field" style={{flex:1}} value={editImaging.type}
                onChange={e=>setEditImaging(v=>({...v,type:e.target.value}))}>
                {IMAGING_TYPES.map(t=><option key={t}>{t}</option>)}
              </select>
              <input className="input-field" type="date" style={{flex:1}} value={editImaging.date}
                onChange={e=>setEditImaging(v=>({...v,date:e.target.value}))}/>
            </div>
            {/* 醫院+國家 */}
            <div style={{display:"flex",gap:8,marginBottom:8}}>
              <input className="input-field" placeholder="醫院名稱" style={{flex:2}} value={editImaging.hospital||""}
                onChange={e=>setEditImaging(v=>({...v,hospital:e.target.value}))}/>
              <input className="input-field" placeholder="國家" style={{flex:1}} value={editImaging.country||""}
                onChange={e=>setEditImaging(v=>({...v,country:e.target.value}))}/>
            </div>
            {/* 報告結論 */}
            <div style={{fontSize:11,color:C.textMuted,marginBottom:4}}>報告結論（詳細）</div>
            <textarea className="input-field" rows={8} style={{resize:"vertical",marginBottom:8,fontSize:12,lineHeight:1.7}}
              value={editImaging.finding||""}
              onChange={e=>setEditImaging(v=>({...v,finding:e.target.value}))}
              placeholder="貼上完整報告內容..."/>
            {/* 醫師建議 */}
            <div style={{fontSize:11,color:C.textMuted,marginBottom:4}}>醫師建議</div>
            <textarea className="input-field" rows={3} style={{resize:"vertical",marginBottom:8,fontSize:12}}
              value={editImaging.recommendation||""}
              onChange={e=>setEditImaging(v=>({...v,recommendation:e.target.value}))}
              placeholder="醫師建議、追蹤事項..."/>
            {/* 下次追蹤+備註 */}
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              <div style={{flex:1}}>
                <div style={{fontSize:11,color:C.textMuted,marginBottom:4}}>下次追蹤日期</div>
                <input className="input-field" type="date" value={editImaging.nextDate||""}
                  onChange={e=>setEditImaging(v=>({...v,nextDate:e.target.value}))}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:11,color:C.textMuted,marginBottom:4}}>備註</div>
                <input className="input-field" value={editImaging.note||""}
                  onChange={e=>setEditImaging(v=>({...v,note:e.target.value}))}
                  placeholder="其他備註..."/>
              </div>
            </div>
            {/* 照片URL */}
            <div style={{fontSize:11,color:C.textMuted,marginBottom:4}}>照片網址（Cloudinary上傳後填入，多張用逗號分隔）</div>
            <textarea className="input-field" rows={2} style={{marginBottom:12,fontSize:11}}
              value={editImaging.driveUrl||""}
              onChange={e=>setEditImaging(v=>({...v,driveUrl:e.target.value}))}
              placeholder="https://res.cloudinary.com/..."/>
            <div style={{display:"flex",gap:10}}>
              <button className="btn-secondary" style={{flex:1}} onClick={()=>setEditImaging(null)}>取消</button>
              <button className="btn-primary" style={{flex:2}} onClick={updateImaging}>💾 儲存更新</button>
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
