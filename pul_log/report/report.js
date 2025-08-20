/* ===========================
 *  report.js  (Daily Report)
 *  v=2025-08-19-05  (/reports routes)
 * =========================== */

/* 전역 유틸 */
function toComma(n){ const v = Number(n) || 0; return v.toLocaleString("ko-KR"); }

/* API Gateway Invoke URL */
const API_BASE = "https://fh5zli5lvi.execute-api.us-east-1.amazonaws.com/prod";
/* 고정 사용자 */
const USER_ID  = "abcd123456-789";

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("backBtn")?.addEventListener("click", () => {
    if (history.length > 1) history.back(); else location.href = "main.html";
  });
  console.info("report.js loaded v=2025-08-19-05");
  loadAndRender();
  preventZoom();
  window.addEventListener("resize", debounce(loadAndRender, 120), { passive:true });
});

/* -------- 메인 렌더 -------- */
async function loadAndRender() {
  const dateStr = getDateFromURL() || todayStr();

  // 초기 UI
  setText("kcalNow","0"); setText("kcalGoal","0");
  setText("recText","추천을 준비 중이에요!");
  renderPie({carb:0, protein:0, fat:0});
  renderMicroGrid({});

  // 서버에서 오늘(특정 날짜) 리포트 GET → 없으면 POST 생성 → 재GET
  const data = await getOrCreateReport(USER_ID, dateStr);
  if (!data) return;

  const macros   = data.macros ?? data.macroRatio ?? {carb:0, protein:0, fat:0};
  const kcalNow  = Number(data.kcalNow ?? data.totalCalories ?? 0);
  const kcalGoal = Number(data.kcalGoal ?? (data.targets?.energy_kcal ?? 2000));
  const rec      = data.recommendation ?? data.summaryLine ?? "";
  const micro    = data.micro ?? data.microStatus12 ?? {};

  setText("kcalNow", toComma(Math.round(kcalNow)));
  setText("kcalGoal", toComma(Math.round(kcalGoal)));
  setText("recText", rec);

  const pct = {
    carb: Math.max(0, Math.min(100, Number(macros.carb)    || 0)),
    protein: Math.max(0, Math.min(100, Number(macros.protein) || 0)),
    fat: Math.max(0, Math.min(100, Number(macros.fat)     || 0))
  };
  renderPie(pct);
  renderMicroGrid(micro);
}

/* -------- API 호출 -------- */
async function getOrCreateReport(userId, dateStr){
  let d = await callGetReport(userId, dateStr);
  if (d) return d;
  await callPostReport(userId, dateStr).catch(()=>null);
  return await callGetReport(userId, dateStr);
}

async function callGetReport(userId, dateStr){
  const url = `${API_BASE}/reports/today?date=${encodeURIComponent(dateStr)}`;
  try{
    const res = await fetch(url, { method:"GET", mode:"cors",
      headers:{ "Content-Type":"application/json", "x-user-id": userId }});
    if(!res.ok) return null;
    let data = await res.json().catch(()=>null);
    if(!data) return null;
    if(typeof data.body === "string"){ try{ data = JSON.parse(data.body); }catch{} }
    return data;
  }catch{ return null; }
}

async function callPostReport(userId, dateStr){
  const url = `${API_BASE}/reports/generate`;
  try{
    const res = await fetch(url, { method:"POST", mode:"cors",
      headers:{ "Content-Type":"application/json", "x-user-id": userId },
      body: JSON.stringify({ date: dateStr }) });
    if(!res.ok) return null;
    let data = await res.json().catch(()=>null);
    if(typeof data?.body === "string"){ try{ data = JSON.parse(data.body); }catch{} }
    return data;
  }catch{ return null; }
}

/* -------- 도넛 차트 (외곽 라벨) -------- */
function renderPie({ carb=0, protein=0, fat=0 }){
  const svg = document.getElementById("pie"); if(!svg) return;
  svg.innerHTML = "";

  const total = Math.max(1, carb + protein + fat);
  const parts = [
    { key:"carb",    label:"탄수화물", val:carb,    color:getCSS("--c-carb") },
    { key:"protein", label:"단백질",   val:protein, color:getCSS("--c-prot") },
    { key:"fat",     label:"지방",     val:fat,     color:getCSS("--c-fat")  },
  ];

  const cx=100, cy=100, rOuter=90, rInner=58; // viewBox(0..200) 기준
  let angle = -90;

  // 배경 링 테두리
  svg.appendChild(elNS("circle", { cx, cy, r:rOuter, fill:getCSS("--panel") }));
  svg.appendChild(elNS("circle", { cx, cy, r:rOuter, fill:"none", stroke:"#0000001f", "stroke-width":1 }));
  svg.appendChild(elNS("circle", { cx, cy, r:rInner, fill:getCSS("--panel") }));
  svg.appendChild(elNS("circle", { cx, cy, r:rInner, fill:"none", stroke:"#0000001f", "stroke-width":1 }));

  for(const p of parts){
    const ratio = p.val/total, sweep = ratio*360;

    if(sweep > 0.1){
      const d = arcDonutPath(cx,cy,rOuter,rInner,angle,angle+sweep);
      svg.appendChild(elNS("path", { d, fill:p.color, opacity: ratio===0 ? 0.12 : 1 }));
    }

    const pct = Math.round(ratio*100);
    if(pct >= 3){
      const mid   = angle + sweep/2;
      const base  = polar(cx,cy,(rOuter+rInner)/2,mid);
      const pOut  = polar(cx,cy,rOuter+4,mid);
      const pText = polar(cx,cy,rOuter+18,mid);

      svg.appendChild(elNS("line",{ x1:base.x,y1:base.y,x2:pOut.x,y2:pOut.y, class:"donut-guide" }));
      svg.appendChild(elNS("line",{ x1:pOut.x,y1:pOut.y,x2:pText.x,y2:pText.y, class:"donut-guide" }));

      const txt = elNS("text",{
        x:pText.x, y:pText.y, "dominant-baseline":"middle",
        "text-anchor": (mid%360>90 && mid%360<270) ? "end" : "start", class:"donut-label"
      });
      txt.textContent = `${p.label} ${pct}%`;
      svg.appendChild(txt);
    }
    angle += sweep;
  }
}
function arcDonutPath(cx,cy,rOuter,rInner,startDeg,endDeg){
  const sO = polar(cx,cy,rOuter,startDeg), eO = polar(cx,cy,rOuter,endDeg);
  const sI = polar(cx,cy,rInner,endDeg),   eI = polar(cx,cy,rInner,startDeg);
  const large = (endDeg - startDeg) % 360 > 180 ? 1 : 0;
  return `M ${sO.x} ${sO.y} A ${rOuter} ${rOuter} 0 ${large} 1 ${eO.x} ${eO.y} L ${sI.x} ${sI.y} A ${rInner} ${rInner} 0 ${large} 0 ${eI.x} ${eI.y} Z`;
}

/* -------- 세부 충족도 -------- */
function renderMicroGrid(micro={}){
  const grid = document.getElementById("microGrid"); if(!grid) return;
  grid.innerHTML = "";
  const LABELS = {
    sodium_mg:"나트륨", added_sugar_g:"첨가당", sat_fat_g:"포화지방", trans_fat_g:"트랜스지방",
    fiber_g:"식이섬유", potassium_mg:"칼륨", calcium_mg:"칼슘", phosphorus_mg:"인",
    vit_b12_ug:"비타민 B12", vit_d_ug:"비타민 D", iron_mg:"철", folate_ug:"엽산",
  };
  const ORDER = ["sodium_mg","added_sugar_g","sat_fat_g","trans_fat_g","fiber_g","potassium_mg","calcium_mg","phosphorus_mg","vit_b12_ug","vit_d_ug","iron_mg","folate_ug"];
  for(const k of ORDER){
    const level = micro?.[k] || "하";
    const cls = level==="상" ? "state-high" : level==="중" ? "state-mid" : "state-low";
    const li = document.createElement("li");
    li.className = "micro-item";
    li.innerHTML = `<div class="state-dot ${cls}" title="${LABELS[k]||k}: ${level}">${level}</div><div class="micro-label">${LABELS[k]||k}</div>`;
    grid.appendChild(li);
  }
}

/* -------- 유틸 -------- */
function elNS(tag,attrs){ const n=document.createElementNS("http://www.w3.org/2000/svg",tag); for(const k in attrs) n.setAttribute(k,attrs[k]); return n; }
function polar(cx,cy,r,deg){ const rad=(deg*Math.PI)/180; return {x:cx+r*Math.cos(rad), y:cy+r*Math.sin(rad)} }
function getCSS(v){ return getComputedStyle(document.documentElement).getPropertyValue(v).trim() }
function setText(id,t){ const el=document.getElementById(id); if(el) el.textContent=String(t) }
function debounce(fn,ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); } }
function todayStr(d=new Date()){ const yyyy=d.getFullYear(), mm=String(d.getMonth()+1).padStart(2,"0"), dd=String(d.getDate()).padStart(2,"0"); return `${yyyy}-${mm}-${dd}` }
function getDateFromURL(){ const u=new URL(location.href); const d=u.searchParams.get("date"); return (d && /^\d{4}-\d{2}-\d{2}$/.test(d))? d : null }
function preventZoom(){ window.addEventListener("gesturestart", e=>e.preventDefault(), {passive:false}); let last=0; document.addEventListener("touchend", e=>{ const now=Date.now(); if(now-last<=350) e.preventDefault(); last=now; }, {passive:false}); window.addEventListener("wheel", e=>{ if(e.ctrlKey||e.metaKey) e.preventDefault(); }, {passive:false}); }
