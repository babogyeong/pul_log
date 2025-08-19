/* API Gateway Invoke URL (HTTP API) */
const API_BASE = "https://fh5zli5lvi.execute-api.us-east-1.amazonaws.com/prod/";

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("backBtn")?.addEventListener("click", () => {
    if (history.length > 1) history.back();
    else location.href = "main.html";
  });

  loadAndRender();
  preventZoom();
  window.addEventListener("resize", debounce(loadAndRender, 120), { passive: true });
});

/* ------------------- 메인 렌더 ------------------- */
async function loadAndRender() {
  // 람다에서 계산된 값을 우선 사용 (없으면 POST로 생성)
  const data = await getOrCreateReport().catch(() => null);

  const macros = data?.macroRatio ?? { carb: 0, protein: 0, fat: 0 };
  const kcalNow = Number(data?.totalCalories ?? 0);
  const kcalGoal = 2000; // 람다에서는 목표 칼로리를 주지 않으므로 기본 2000으로 표시(원하면 서버에서 내려주세요)
  const rec = data?.summaryLine ?? "추천을 준비 중이에요!";

  // 1) 큰 도넛
  renderPie({
    carb: Number(macros.carb || 0),
    protein: Number(macros.protein || 0),
    fat: Number(macros.fat || 0),
  });

  // 2) 텍스트
  document.getElementById("kcalNow").textContent = toComma(kcalNow);
  document.getElementById("kcalGoal").textContent = toComma(kcalGoal);

  // 3) 작은 원형 3개
  setMiniRing("ringCarb", "pctCarb", Math.round(macros.carb || 0), "--c-carb");
  setMiniRing("ringProtein", "pctProtein", Math.round(macros.protein || 0), "--c-prot");
  setMiniRing("ringFat", "pctFat", Math.round(macros.fat || 0), "--c-fat");

  // 4) 부영양소 충족도(람다에서 내려준 키만 동적 표시)
  renderMicroGridFromLambda(data?.microStatus || {});

  // 5) 코멘트
  document.getElementById("recText").textContent = rec;
}

/* ------------------- 큰 도넛(SVG) ------------------- */
function renderPie({ carb = 0, protein = 0, fat = 0 }) {
  const svg = document.getElementById("pie");
  if (!svg) return;

  const sum = Math.max(1, carb + protein + fat);
  const parts = [
    { label: "탄수화물", val: carb, color: getCSS("--c-carb") },
    { label: "단백질",  val: protein, color: getCSS("--c-prot") },
    { label: "지방",    val: fat,     color: getCSS("--c-fat") },
  ];

  svg.innerHTML = "";
  const cx = 110, cy = 110, r = 100, hole = 60;
  let angle = -90;

  svg.appendChild(el("circle", { cx, cy, r, fill: getCSS("--panel") }));

  parts.forEach((p) => {
    const ratio = p.val / sum;
    const sweep = ratio * 360;
    const start = polar(cx, cy, r, angle);
    const end   = polar(cx, cy, r, angle + sweep);
    const largeArc = sweep > 180 ? 1 : 0;

    const d = [
      `M ${cx} ${cy}`,
      `L ${start.x} ${start.y}`,
      `A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`,
      "Z",
    ].join(" ");
    svg.appendChild(el("path", { d, fill: p.color, opacity: ratio === 0 ? 0.12 : 1 }));
    angle += sweep;
  });

  svg.appendChild(el("circle", { cx, cy, r: hole, fill: getCSS("--panel") }));
}

/* ------------------- 작은 원형 게이지 ------------------- */
function setMiniRing(ringId, pctId, pct, colorVar) {
  const ring = document.getElementById(ringId);
  if (!ring) return;
  ring.style.setProperty("--p", pct + "%");
  ring.style.setProperty("--col", getCSS(colorVar));
  const text = document.getElementById(pctId);
  if (text) text.textContent = `${pct}%`;
}

/* ------------------- 람다의 microStatus 동적 렌더 ------------------- */
/* 키 → 라벨 매핑(람다에서 주는 키명 기준) */
const MICRO_LABELS = {
  sodium: "나트륨",
  potassium: "칼륨",
  calcium: "칼슘",
  fiber: "식이섬유",
  phosphorus: "인",
  vit_b12: "B12",
  added_sugar: "첨가당",
  sat_fat: "포화지방",
  trans_fat: "트랜스",
  vit_d: "비타민D",
  iron: "철",
  folate: "엽산",
};

function renderMicroGridFromLambda(micro = {}) {
  const wrap = document.getElementById("microGrid");
  if (!wrap) return;
  wrap.innerHTML = "";

  // 람다가 내려준 항목만 그리기
  const entries = Object.entries(micro);
  if (entries.length === 0) {
    // 아무것도 없으면 안내만
    wrap.innerHTML = `<li class="micro-item"><div class="micro-label">세부 지표가 없습니다</div></li>`;
    return;
  }

  entries.forEach(([key, lv]) => {
    const label = MICRO_LABELS[key] || key;
    const cls = lv === "상" ? "state-high" : lv === "중" ? "state-mid" : "state-low";
    const li = document.createElement("li");
    li.className = "micro-item";
    li.innerHTML = `
      <div class="state-dot ${cls}" title="${label}: ${lv}">${lv}</div>
      <div class="micro-label">${label}</div>
    `;
    wrap.appendChild(li);
  });
}

/* ------------------- 서버 호출 ------------------- */
async function getOrCreateReport() {
  const userId = localStorage.getItem("vegan_user_id") || "demo";
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

  // 1) 우선 GET
  let raw = await callGetReport(userId, dateStr);

  // 2) 없으면 POST로 생성 → 그 결과 사용
  if (!raw || !raw.summaryLine) {
    raw = await callPostReport(userId, dateStr);
  }
  return raw;
}

async function callGetReport(userId, dateStr) {
  const url = `${API_BASE}/getDailyReportLambda?date=${encodeURIComponent(dateStr)}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", "x-user-id": userId },
    method: "GET", mode: "cors",
  });
  let data = await res.json().catch(() => null);
  if (!data) return null;
  if (typeof data.body === "string") { try { data = JSON.parse(data.body); } catch {} }
  return data && Object.keys(data).length ? data : null;
}

async function callPostReport(userId, dateStr) {
  const url = `${API_BASE}/getDailyReportLambda`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", "x-user-id": userId },
    method: "POST", mode: "cors",
    body: JSON.stringify({ date: dateStr }),
  });
  let data = await res.json().catch(() => null);
  if (!data) return null;
  if (typeof data.body === "string") { try { data = JSON.parse(data.body); } catch {} }
  return data;
}

/* ------------------- 유틸 ------------------- */
function el(tag, attrs){const n=document.createElementNS("http://www.w3.org/2000/svg",tag);for(const k in attrs)n.setAttribute(k,attrs[k]);return n;}
function polar(cx,cy,r,deg){const rad=(deg*Math.PI)/180;return{ x:cx+r*Math.cos(rad), y:cy+r*Math.sin(rad) };}
function getCSS(v){return getComputedStyle(document.documentElement).getPropertyValue(v).trim();}
function toComma(n){const v=Number(n)||0;return v.toLocaleString("ko-KR");}
function debounce(fn,ms){let t;return (...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms)}}
function preventZoom(){
  window.addEventListener("gesturestart",(e)=>e.preventDefault(),{passive:false});
  let last=0;document.addEventListener("touchend",(e)=>{const now=Date.now();if(now-last<=350)e.preventDefault();last=now},{passive:false});
  window.addEventListener("wheel",(e)=>{if(e.ctrlKey||e.metaKey)e.preventDefault()},{passive:false});
}
