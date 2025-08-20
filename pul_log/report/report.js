/* API Gateway Invoke URL (HTTP API) */
const API_BASE = "https://fh5zli5lvi.execute-api.us-east-1.amazonaws.com/prod/";

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("backBtn")?.addEventListener("click", () => {
    if (history.length > 1) history.back();
    else location.href = "main.html"; // 기본 이동 페이지
  });

  loadAndRender();
  preventZoom();
  window.addEventListener("resize", debounce(loadAndRender, 120), {
    passive: true,
  });
});

/* ------------------- 메인 렌더 ------------------- */
async function loadAndRender() {
  const data = await getOrCreateReport().catch(() => null);

  // 데이터 없으면 기본값으로
  const macros = data?.macroRatio ?? { carb: 0, protein: 0, fat: 0 };
  const kcalNow = Number(data?.totalCalories ?? 0);
  const kcalGoal = 2000; // 목표 칼로리는 기본 2000으로 설정
  const rec = data?.summaryLine ?? "추천을 준비 중이에요!";

  // 1) 파이 차트 렌더링
  renderPie({
    carb: Number(macros.carb || 0),
    protein: Number(macros.protein || 0),
    fat: Number(macros.fat || 0),
  });

  // 2) 칼로리 텍스트 업데이트
  document.getElementById("kcalNow").textContent = toComma(kcalNow);
  document.getElementById("kcalGoal").textContent = toComma(kcalGoal);

  // 3) 부영양소 충족도 렌더링
  renderMicroGridFromLambda(data?.microStatus || {});

  // 4) 추천 코멘트 업데이트
  document.getElementById("recText").textContent = rec;
}

/* ------------------- 파이차트(SVG) - 원본 버전으로 수정 ------------------- */
function renderPie({ carb = 0, protein = 0, fat = 0 }) {
  const svg = document.getElementById("pie");
  if (!svg) return;

  const total = Math.max(1, carb + protein + fat);
  const parts = [
    { label: "탄수화물", val: carb, color: getCSS("--c-carb") },
    { label: "단백질", val: protein, color: getCSS("--c-prot") },
    { label: "지방", val: fat, color: getCSS("--c-fat") },
  ];

  svg.innerHTML = ""; // SVG 초기화

  const cx = 100, cy = 100, r = 90;
  let angle = -90; // 12시 방향에서 시작

  // 배경 원
  const bg = el("circle", { cx, cy, r, fill: getCSS("--panel") });
  svg.appendChild(bg);

  parts.forEach((p) => {
    const ratio = p.val / total;
    if (ratio === 0) return; // 비율이 0이면 그리지 않음

    const sweep = ratio * 360;
    const start = polar(cx, cy, r, angle);
    const end = polar(cx, cy, r, angle + sweep);
    const largeArc = sweep > 180 ? 1 : 0;

    const pathData = [
      `M ${cx} ${cy}`, `L ${start.x} ${start.y}`,
      `A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`, "Z",
    ].join(" ");

    const path = el("path", { d: pathData, fill: p.color });
    svg.appendChild(path);

    // 라벨(백분율)
    const midAngle = angle + sweep / 2;
    const labelPos = polar(cx, cy, r * 0.6, midAngle);
    const pct = Math.round(ratio * 100);

    if (pct >= 5) { // 5% 이상일 때만 라벨 표시 (가독성)
      const text = el("text", {
        x: labelPos.x, y: labelPos.y,
        "text-anchor": "middle", "dominant-baseline": "central",
        fill: "#ffffffcc", "font-size": "14", "font-weight": "700",
      });
      text.textContent = `${pct}%`;
      svg.appendChild(text);
    }
    angle += sweep;
  });
}

/* ------------------- 람다의 microStatus 동적 렌더 (기존 유지) ------------------- */
const MICRO_LABELS = {
  sodium: "나트륨", potassium: "칼륨", calcium: "칼슘",
  fiber: "식이섬유", phosphorus: "인", vit_b12: "B12",
  added_sugar: "첨가당", sat_fat: "포화지방", trans_fat: "트랜스",
  vit_d: "비타민D", iron: "철", folate: "엽산",
};

function renderMicroGridFromLambda(micro = {}) {
  const wrap = document.getElementById("microGrid");
  if (!wrap) return;
  wrap.innerHTML = "";

  const entries = Object.entries(micro);
  if (entries.length === 0) {
    const li = document.createElement("li");
    li.style.gridColumn = "1 / -1"; // 전체 너비 차지
    li.innerHTML = `<div class="micro-label">세부 영양 데이터가 없습니다.</div>`;
    wrap.appendChild(li);
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

/* ------------------- 서버 호출 (기존 유지) ------------------- */
async function getOrCreateReport() {
  const userId = localStorage.getItem("vegan_user_id") || "demo";
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  let raw = await callGetReport(userId, dateStr);
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

/* ------------------- 유틸 (기존 유지) ------------------- */
function el(tag, attrs) { const n = document.createElementNS("http://www.w3.org/2000/svg", tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; }
function polar(cx, cy, r, deg) { const rad = (deg * Math.PI) / 180; return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }; }
function getCSS(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
function toComma(n) { const v = Number(n) || 0; return v.toLocaleString("ko-KR"); }
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function preventZoom() {
  window.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });
  let last = 0; document.addEventListener("touchend", (e) => { const now = Date.now(); if (now - last <= 350) e.preventDefault(); last = now; }, { passive: false });
  window.addEventListener("wheel", (e) => { if (e.ctrlKey || e.metaKey) e.preventDefault(); }, { passive: false });
}
