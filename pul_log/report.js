/* ===========================
 *  report.js  (Daily Report)
 * =========================== */

/* API Gateway Invoke URL (Stage까지) — 끝 슬래시 없음 */
const API_BASE = "https://fh5zli5lvi.execute-api.us-east-1.amazonaws.com/prod";

/* 선택: 사용자 ID 보관 방식 */
const USER_ID = (localStorage.getItem("userId") || "demo");

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("backBtn")?.addEventListener("click", () => {
    if (history.length > 1) history.back(); else location.href = "main.html";
  });

  loadAndRender();
  preventZoom();
  window.addEventListener("resize", debounce(loadAndRender, 120), { passive: true });
});

/* ------------------- 메인 렌더 ------------------- */
async function loadAndRender() {
  const dateStr = getDateFromURL() || todayStr();

  // 0) 초기 표시
  setText("kcalNow", "0");
  setText("kcalGoal", "0");
  setText("recText", "추천을 준비 중이에요!");
  setText("pctCarb", "0%");
  setText("pctProtein", "0%");
  setText("pctFat", "0%");
  renderPie({ carb: 0, protein: 0, fat: 0 });
  renderRings({ carb: 0, protein: 0, fat: 0 });
  renderMicroGrid({});

  // 1) 데이터 호출 (GET → 실패 시 POST 생성 → GET 재시도)
  const data = await getOrCreateReport(USER_ID, dateStr);
  if (!data) return; // 네트워크/404 등

  // 2) 응답 스키마 호환 처리
  const macros   = data.macros ?? data.macroRatio ?? { carb: 0, protein: 0, fat: 0 };
  const kcalNow  = Number(data.kcalNow ?? data.totalCalories ?? 0);
  const kcalGoal = Number(data.kcalGoal ?? 2000);
  const rec      = data.recommendation ?? data.summaryLine ?? "추천을 준비 중이에요!";
  const micro    = data.micro ?? data.microStatus12 ?? {};

  // 3) 표시
  setText("kcalNow", toComma(Math.round(kcalNow)));
  setText("kcalGoal", toComma(Math.round(kcalGoal)));
  setText("recText", rec);

  const pctCarb = clampPct(macros.carb);
  const pctProt = clampPct(macros.protein);
  const pctFat  = clampPct(macros.fat);

  setText("pctCarb", pctCarb + "%");
  setText("pctProtein", pctProt + "%");
  setText("pctFat", pctFat + "%");

  renderPie({ carb: pctCarb, protein: pctProt, fat: pctFat });
  renderRings({ carb: pctCarb, protein: pctProt, fat: pctFat });
  renderMicroGrid(micro);
}

/* ------------------- API ------------------- */
async function getOrCreateReport(userId, dateStr) {
  // 1차: GET
  let data = await callGetReport(userId, dateStr);
  if (data) return data;

  // 2차: POST로 생성 시도
  await callPostReport(userId, dateStr).catch(() => null);

  // 3차: 다시 GET
  data = await callGetReport(userId, dateStr);
  return data || null;
}

async function callGetReport(userId, dateStr) {
  const url = `${API_BASE}/getDailyReportLambda?date=${encodeURIComponent(dateStr)}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      mode: "cors",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
    });
    if (!res.ok) return null;
    let data = await res.json().catch(() => null);
    if (!data) return null;
    if (typeof data.body === "string") { try { data = JSON.parse(data.body); } catch {} }
    return (data && typeof data === "object") ? data : null;
  } catch {
    return null;
  }
}

async function callPostReport(userId, dateStr) {
  const url = `${API_BASE}/getDailyReportLambda`;
  try {
    const res = await fetch(url, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
      body: JSON.stringify({ date: dateStr }),
    });
    if (!res.ok) return null;
    let data = await res.json().catch(() => null);
    if (!data) return null;
    if (typeof data.body === "string") { try { data = JSON.parse(data.body); } catch {} }
    return data;
  } catch {
    return null;
  }
}

/* ------------------- 도넛(SVG) ------------------- */
function renderPie({ carb = 0, protein = 0, fat = 0 }) {
  const svg = document.getElementById("pie");
  if (!svg) return;

  // 정규화
  const total = Math.max(1, carb + protein + fat);
  const frac = [
    { key: "carb",    val: carb    / total, color: getCSS("--c-carb") },
    { key: "protein", val: protein / total, color: getCSS("--c-prot") },
    { key: "fat",     val: fat     / total, color: getCSS("--c-fat")  },
  ];

  // 초기화
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  // 파라미터
  const cx = 110, cy = 110;
  const rOuter = 100, rInner = 68; // 두께 약 32
  let start = -90; // 12시 시작

  // 각 조각
  for (const part of frac) {
    const deg = part.val * 360;
    const end = start + deg;
    if (deg > 0.1) {
      const p = arcDonutPath(cx, cy, rOuter, rInner, start, end);
      const path = elNS("path", { d: p, fill: part.color, "aria-label": part.key });
      svg.appendChild(path);
    }
    start = end;
  }

  // 경계선(안쪽, 바깥쪽)
  const ringStroke = "#0000001f";
  svg.appendChild(elNS("circle", { cx, cy, r: rOuter, fill: "none", stroke: ringStroke, "stroke-width": 1 }));
  svg.appendChild(elNS("circle", { cx, cy, r: rInner, fill: "none", stroke: ringStroke, "stroke-width": 1 }));
}

function arcDonutPath(cx, cy, rOuter, rInner, startDeg, endDeg) {
  const sO = polar(cx, cy, rOuter, startDeg);
  const eO = polar(cx, cy, rOuter, endDeg);
  const sI = polar(cx, cy, rInner, endDeg);
  const eI = polar(cx, cy, rInner, startDeg);
  const large = (endDeg - startDeg) % 360 > 180 ? 1 : 0;

  return [
    `M ${sO.x} ${sO.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${eO.x} ${eO.y}`,
    `L ${sI.x} ${sI.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${eI.x} ${eI.y}`,
    "Z",
  ].join(" ");
}

/* ------------------- 작은 링 3개 ------------------- */
function renderRings({ carb = 0, protein = 0, fat = 0 }) {
  const ringCarb = document.getElementById("ringCarb");
  const ringProt = document.getElementById("ringProtein");
  const ringFat  = document.getElementById("ringFat");

  if (ringCarb) {
    ringCarb.style.setProperty("--p", `${carb}%`);
    ringCarb.style.setProperty("--col", getCSS("--c-carb"));
  }
  if (ringProt) {
    ringProt.style.setProperty("--p", `${protein}%`);
    ringProt.style.setProperty("--col", getCSS("--c-prot"));
  }
  if (ringFat) {
    ringFat.style.setProperty("--p", `${fat}%`);
    ringFat.style.setProperty("--col", getCSS("--c-fat"));
  }
}

/* ------------------- 세부 충족도 그리드 ------------------- */
function renderMicroGrid(micro = {}) {
  const grid = document.getElementById("microGrid");
  if (!grid) return;
  grid.innerHTML = "";

  const LABELS = {
    sodium_mg: "나트륨",
    added_sugar_g: "첨가당",
    sat_fat_g: "포화지방",
    trans_fat_g: "트랜스지방",
    fiber_g: "식이섬유",
    potassium_mg: "칼륨",
    calcium_mg: "칼슘",
    phosphorus_mg: "인",
    vit_b12_ug: "비타민 B12",
    vit_d_ug: "비타민 D",
    iron_mg: "철",
    folate_ug: "엽산",
  };

  const ORDER = [
    "sodium_mg","added_sugar_g","sat_fat_g","trans_fat_g",
    "fiber_g","potassium_mg","calcium_mg","phosphorus_mg",
    "vit_b12_ug","vit_d_ug","iron_mg","folate_ug"
  ];

  for (const k of ORDER) {
    const level = (micro?.[k] || "하"); // 상/중/하
    const cls =
      level === "상" ? "state-high" :
      level === "중" ? "state-mid"  :
                       "state-low";

    const li = document.createElement("li");
    li.className = "micro-item";
    li.innerHTML = `
      <div class="state-dot ${cls}">${level}</div>
      <div class="micro-label">${LABELS[k] || k}</div>
    `;
    grid.appendChild(li);
  }
}

/* ------------------- 유틸 ------------------- */
function elNS(tag, attrs) {
  const n = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
}
function polar(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function getCSS(v) {
  return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
}
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(text);
}
function toComma(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("ko-KR");
}
function clampPct(v) {
  const n = Math.max(0, Math.min(100, Number(v) || 0));
  return Math.round(n);
}
function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
function todayStr(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function getDateFromURL() {
  const u = new URL(location.href);
  const d = u.searchParams.get("date");
  return (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) ? d : null;
}

/* 확대/더블탭 줌 방지(모바일 UX) */
function preventZoom() {
  window.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });
  let last = 0;
  document.addEventListener("touchend", (e) => {
    const now = Date.now();
    if (now - last <= 350) e.preventDefault();
    last = now;
  }, { passive: false });
  window.addEventListener("wheel", (e) => {
    if (e.ctrlKey || e.metaKey) e.preventDefault();
  }, { passive: false });
}
