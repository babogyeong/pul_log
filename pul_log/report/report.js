/* ===========================
 *  report.js  (Daily Report)
 *  v=2025-08-20-PIE (SVG 파이차트 버전)
 *  - /reports API 사용
 * =========================== */

/* ---------- 유틸 ---------- */
function toComma(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("ko-KR");
}
window.toComma = toComma;

function getCSS(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(text);
}
function clampPct(v) {
  return Math.max(0, Math.min(100, Number(v) || 0));
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
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}
function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}
function preventZoom() {
  // 모바일 더블탭/핀치 줌 방지
  window.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });
  let last = 0;
  document.addEventListener(
    "touchend",
    (e) => {
      const now = Date.now();
      if (now - last <= 350) e.preventDefault();
      last = now;
    },
    { passive: false }
  );
  window.addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    },
    { passive: false }
  );
}

/* ---------- SVG 헬퍼 ---------- */
function el(tag, attrs = {}) {
  const n = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
}
function polar(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/* ---------- API ---------- */
/* API Gateway Invoke URL (Stage까지) — 끝  슬래시 없음 */
const API_BASE = "https://fh5zli5lvi.execute-api.us-east-1.amazonaws.com/prod";
/* 고정 사용자 */
const USER_ID = "abcd123456-789";

async function getOrCreateReport(userId, dateStr) {
  let data = await callGetReport(userId, dateStr);
  if (data) return data;

  await callPostReport(userId, dateStr).catch(() => null);
  data = await callGetReport(userId, dateStr);
  return data || null;
}
async function callGetReport(userId, dateStr) {
  // /reports/today?date=YYYY-MM-DD
  const url = `${API_BASE}/reports/today?date=${encodeURIComponent(dateStr)}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      mode: "cors",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId,
      },
    });
    if (!res.ok) return null;
    let data = await res.json().catch(() => null);
    if (!data) return null;
    if (typeof data.body === "string") {
      try {
        data = JSON.parse(data.body);
      } catch {}
    }
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
}
async function callPostReport(userId, dateStr) {
  // /reports/generate
  const url = `${API_BASE}/reports/generate`;
  try {
    const res = await fetch(url, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId,
      },
      body: JSON.stringify({ date: dateStr }),
    });
    if (!res.ok) return null;
    let data = await res.json().catch(() => null);
    if (!data) return null;
    if (typeof data.body === "string") {
      try {
        data = JSON.parse(data.body);
      } catch {}
    }
    return data;
  } catch {
    return null;
  }
}

/* ---------- 초기 바인딩 ---------- */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("backBtn")?.addEventListener("click", () => {
    if (history.length > 1) history.back();
    else location.href = "../main/main.html";
  });

  console.info("report.js v=2025-08-20-PIE (/reports routes, SVG pie)");
  loadAndRender();
  preventZoom();
  window.addEventListener("resize", debounce(loadAndRender, 150), { passive: true });
});

/* ---------- 메인 로드 & 렌더 ---------- */
async function loadAndRender() {
  const dateStr = getDateFromURL() || todayStr();

  // 초기 UI
  setText("kcalNow", "0");
  setText("kcalGoal", "0");
  setText("recText", "데이터를 불러오는 중...");
  renderPie({ carb: 0, protein: 0, fat: 0 });
  renderMicroGrid({});

  // 데이터 로드
  const data = await getOrCreateReport(USER_ID, dateStr);
  if (!data) return;

  const macros =
    data.macros ??
    data.macroRatio ?? { carb: 0, protein: 0, fat: 0 };

  const kcalNow = Number(data.kcalNow ?? data.totalCalories ?? 0);
  const kcalGoal = Number(data.kcalGoal ?? (data.targets?.energy_kcal ?? 3000));
  const rec = data.recommendation ?? data.summaryLine ?? "식단 정보를 더 쌓아 보세요!";
  const micro = data.micro ?? data.microStatus12 ?? {};

  setText("kcalNow", toComma(Math.round(kcalNow)));
  setText("kcalGoal", toComma(Math.round(kcalGoal)));
  setText("recText", rec);

  // 파이차트 렌더 (값이 0~100 이든 합이 100이 아니든 비율로 그려짐)
  const c = clampPct(macros.carb);
  const p = clampPct(macros.protein);
  const f = clampPct(macros.fat);
  renderPie({ carb: c, protein: p, fat: f });

  // 부영양소 상태
  renderMicroGrid(micro);
}

/* ---------- 파이차트 (SVG) ---------- */
function renderPie({ carb = 0, protein = 0, fat = 0 }) {
  const svg = document.getElementById("pie");
  if (!svg) return;

  // 비율 합이 0이면 모두 0% 원 그리기
  const total = Math.max(1, carb + protein + fat);
  const parts = [
    { label: "탄수화물", val: carb, color: getCSS("--c-carb") },
    { label: "단백질",  val: protein, color: getCSS("--c-prot") },
    { label: "지방",    val: fat,     color: getCSS("--c-fat") },
  ];

  // 클리어
  svg.innerHTML = "";

  const cx = 100, cy = 100, r = 90;
  let angle = -90; // 12시 방향 시작

  // background circle
  const bg = el("circle", { cx, cy, r, fill: getCSS("--panel") });
  svg.appendChild(bg);

  parts.forEach((p) => {
    const ratio = p.val / total;
    const sweep = ratio * 360;

    // 호 그리기
    const start = polar(cx, cy, r, angle);
    const end = polar(cx, cy, r, angle + sweep);
    const largeArc = sweep > 180 ? 1 : 0;

    const pathData = [
      `M ${cx} ${cy}`,
      `L ${start.x} ${start.y}`,
      `A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`,
      "Z",
    ].join(" ");

    const path = el("path", {
      d: pathData,
      fill: p.color,
      opacity: ratio === 0 ? 0.12 : 1,
    });
    svg.appendChild(path);

    // 라벨(백분율)
    const mid = angle + sweep / 2;
    const labelPos = polar(cx, cy, r * 0.6, mid);
    const pct = Math.round(ratio * 100);
    if (pct >= 1) {
      // 1% 미만 라벨은 생략
      const text = el("text", {
        x: labelPos.x,
        y: labelPos.y,
        "text-anchor": "middle",
        "dominant-baseline": "central",
        fill: "#ffffffcc",
        "font-size": "12",
        "font-weight": "700",
      });
      text.textContent = `${pct}%`;
      svg.appendChild(text);
    }

    angle += sweep;
  });
}

/* ---------- 세부 충족도(12개) ---------- */
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
    "sodium_mg",
    "added_sugar_g",
    "sat_fat_g",
    "trans_fat_g",
    "fiber_g",
    "potassium_mg",
    "calcium_mg",
    "phosphorus_mg",
    "vit_b12_ug",
    "vit_d_ug",
    "iron_mg",
    "folate_ug",
  ];

  for (const k of ORDER) {
    const level = micro?.[k] || "하";
    const cls =
      level === "상" ? "state-high" : level === "중" ? "state-mid" : "state-low";

    const li = document.createElement("li");
    li.className = "micro-item";
    li.innerHTML = `
      <div class="state-dot ${cls}" title="${LABELS[k] || k}: ${level}">${level}</div>
      <div class="micro-label">${LABELS[k] || k}</div>
    `;
    grid.appendChild(li);
  }
}
