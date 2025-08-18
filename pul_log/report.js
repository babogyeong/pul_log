/* 리포트 페이지 스크립트
   - 서버 연동 전: mock 데이터 사용
   - 이후 getTodayReport()만 교체하면 그대로 동작
*/

document.addEventListener("DOMContentLoaded", () => {
  // 뒤로가기
  document.getElementById("backBtn")?.addEventListener("click", () => {
    if (history.length > 1) history.back();
    else window.location.href = "main.html"; // 직접 링크로 대체 가능
  });

  // 데이터 로드 → 렌더
  loadAndRender();

  // 확대 제한
  preventZoom();

  // 리사이즈 시 차트 재렌더(뷰박스 기반이라 필요는 적지만, 숫자/라벨 가독성 위해)
  window.addEventListener("resize", debounce(loadAndRender, 120), {
    passive: true,
  });
});

async function loadAndRender() {
  const data = await getTodayReport().catch(() => null);

  // 데이터 없으면 빈 상태로
  const macros = data?.macros ?? { carb: 0, protein: 0, fat: 0 };
  const kcalNow = data?.kcalNow ?? 0;
  const kcalGoal = data?.kcalGoal ?? 0;
  const rec = data?.recommendation ?? "추천을 준비 중이에요!";

  renderPie(macros);
  document.getElementById("kcalNow").textContent = toComma(kcalNow);
  document.getElementById("kcalGoal").textContent = toComma(kcalGoal || 0);
  document.getElementById("recText").textContent = rec;
}

/* ---------- 파이차트 (SVG) ---------- */
function renderPie({ carb = 0, protein = 0, fat = 0 }) {
  const svg = document.getElementById("pie");
  if (!svg) return;

  // 비율 합이 0이면 모두 0% 원 그리기
  const total = Math.max(1, carb + protein + fat);
  const parts = [
    { label: "탄수화물", val: carb, color: getCSS("--c-carb") },
    { label: "단백질", val: protein, color: getCSS("--c-prot") },
    { label: "지방", val: fat, color: getCSS("--c-fat") },
  ];

  // 클리어
  svg.innerHTML = "";

  const cx = 100,
    cy = 100,
    r = 90;
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

/* ---------- 데이터(서버 대체 모듈) ---------- */
async function getTodayReport() {
  // TODO: 실제 서버로 교체
  // 예: const res = await fetch('/api/report/today'); return await res.json();

  // 임시 목데이터 (디자이너 시안 비율과 유사: 50/30/20)
  await sleep(120); // 로딩 체감
  const mock = {
    macros: { carb: 50, protein: 30, fat: 20 }, // %
    kcalNow: 1206,
    kcalGoal: 2000,
    recommendation: "비타민C, 무기질을 채우기 위한 고등어조림을 추천합니다!",
  };
  return mock;
}

/* ---------- 유틸 ---------- */
function el(tag, attrs) {
  const n = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
}
function polar(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function getCSS(varName) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
}
function toComma(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("ko-KR");
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

/* 확대 제한 */
function preventZoom() {
  window.addEventListener("gesturestart", (e) => e.preventDefault(), {
    passive: false,
  });
  let lastTouchEnd = 0;
  document.addEventListener(
    "touchend",
    (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 350) e.preventDefault();
      lastTouchEnd = now;
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
