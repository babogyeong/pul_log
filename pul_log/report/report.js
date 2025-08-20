/* ===========================
 * report.js (Daily Report)
 * =========================== */

/* API Gateway Invoke URL (Stage까지) — 끝 슬래시 없음 */
const API_BASE =
  "https://fh5zli5lvi.execute-api.us-east-1.amazonaws.com/prod";

/* 고정 사용자 (요청 사항) — 이 사용자 데이터만 DynamoDB에서 사용 */
const USER_ID = "abcd123456-789";

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("backBtn")?.addEventListener("click", () => {
    if (history.length > 1) history.back();
    else location.href = "main.html";
  });

  const dateInput = document.getElementById("dateInput");
  dateInput.value = getDateFromURL() || todayStr();

  document.getElementById("reloadBtn")?.addEventListener("click", () => {
    const d = dateInput.value || todayStr();
    const url = new URL(location.href);
    url.searchParams.set("date", d);
    history.replaceState(null, "", url.toString());
    loadAndRender();
  });

  loadAndRender();
  preventZoom();
  window.addEventListener("resize", debounce(loadAndRender, 120), {
    passive: true,
  });
});

/* ------------------- 메인 렌더 ------------------- */
async function loadAndRender() {
  const dateStr = getDateFromURL() || todayStr();

  // 초기 표시
  setText("kcalNow", "0");
  setText("kcalGoal", "0");
  setText("recText", "추천을 준비 중이에요!");
  clearNode(document.getElementById("pie"));
  clearNode(document.getElementById("legend"));
  clearNode(document.getElementById("microGrid"));

  try {
    const data = await getOrCreateReport(USER_ID, dateStr);

    const {
      summaryLine = "추천을 준비 중이에요!",
      macroRatio = { carb: 0, protein: 0, fat: 0 },
      totalCalories = { now: 0, goal: 0 },
      microStatus = [], // [{name, ratio(0~1), level:'상|중|하'}]
    } = data || {};

    // 칼로리
    setText("kcalNow", toComma(totalCalories.now || 0));
    setText("kcalGoal", toComma(totalCalories.goal || 0));

    // 추천 문장
    setText("recText", summaryLine || "추천을 준비 중이에요!");

    // 탄단지 파이차트
    renderPie(macroRatio);

    // 부영양소 그리드
    renderMicro(microStatus);
  } catch (err) {
    console.error("[loadAndRender] failed:", err);
    setText("recText", "리포트를 불러오는 중 오류가 발생했습니다.");
  }
}

/* ------------------- API 호출부 (경로 수정됨) ------------------- */
/** GET 우선, 실패 시 POST 폴백 — 모두 user_id를 포함 */
async function getOrCreateReport(userId, dateStr) {
  // 1) GET (사전요청 없는 단순 쿼리)
  // ★★★ 경로 수정: /getDailyReportLambda -> /reports/today ★★★
  const getUrl = `${API_BASE}/reports/today?user_id=${encodeURIComponent(
    userId
  )}&date=${encodeURIComponent(dateStr)}`;

  let res;
  try {
    res = await fetch(getUrl, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      cache: "no-cache",
    });

    if (res.ok) return await parseApiResponse(res);
    // 404/405/500 등은 POST로 재시도
  } catch (e) {
    // 네트워크 실패 시 POST 폴백
  }

  // 2) POST (바디 전달)
  // ★★★ 경로 수정: /getDailyReportLambda -> /reports/generate ★★★
  const postUrl = `${API_BASE}/reports/generate`;
  const res2 = await fetch(postUrl, {
    method: "POST",
    mode: "cors",
    credentials: "omit",
    cache: "no-cache",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id: userId, date: dateStr }),
  });

  if (!res2.ok) {
    const text = await res2.text().catch(() => "");
    throw new Error(`[POST] ${res2.status} ${res2.statusText} :: ${text}`);
  }

  return await parseApiResponse(res2);
}


/** Lambda가 body 문자열/객체 어느 쪽이든 대응 */
async function parseApiResponse(res) {
  let payload = await res.json().catch(async () => {
    const t = await res.text();
    try {
      return JSON.parse(t);
    } catch {
      return { error: "invalid json", raw: t };
    }
  });

  // { body: "json-string" } 형태면 내부 파싱
  if (payload && typeof payload.body === "string") {
    try {
      payload = JSON.parse(payload.body);
    } catch {
      // 그대로 둠
    }
  }
  return payload;
}

/* ------------------- 렌더러 ------------------- */
function renderPie(macroRatio) {
  const wrap = document.getElementById("pie");
  clearNode(wrap);

  const carb = clamp01(macroRatio.carb ?? macroRatio.carbohydrate ?? 0);
  const protein = clamp01(macroRatio.protein ?? 0);
  const fat = clamp01(macroRatio.fat ?? 0);

  const total = carb + protein + fat || 1; // 0분모 방지
  const parts = [
    { key: "탄수화물", value: carb / total, color: getCSS("--c-carb") },
    { key: "단백질", value: protein / total, color: getCSS("--c-prot") },
    { key: "지방", value: fat / total, color: getCSS("--c-fat") },
  ];

  // SVG 파이
  const size = 260;
  const r = size / 2 - 6;
  const cx = size / 2;
  const cy = size / 2;

  const svg = el("svg", { width: size, height: size, viewBox: `0 0 ${size} ${size}` });

  let start = -90; // 12시 방향
  parts.forEach((p) => {
    const sweep = p.value * 360;
    const end = start + sweep;

    const s = polar(cx, cy, r, start);
    const e = polar(cx, cy, r, end);
    const largeArc = sweep > 180 ? 1 : 0;

    const path = el("path", {
      d: [
        `M ${cx} ${cy}`,
        `L ${s.x} ${s.y}`,
        `A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`,
        "Z",
      ].join(" "),
      fill: p.color,
    });
    svg.appendChild(path);

    start = end;
  });

  wrap.appendChild(svg);

  // 범례
  const legend = document.getElementById("legend");
  clearNode(legend);
  parts.forEach((p) => {
    const li = document.createElement("li");
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background = p.color;
    const label = document.createElement("span");
    label.textContent = `${p.key} ${(p.value * 100).toFixed(0)}%`;
    li.appendChild(dot);
    li.appendChild(label);
    legend.appendChild(li);
  });
}

function renderMicro(microList) {
  const grid = document.getElementById("microGrid");
  clearNode(grid);

  const list = Array.isArray(microList) ? microList : [];
  if (!list.length) {
    const p = document.createElement("p");
    p.className = "rec-text";
    p.textContent = "부영양소 데이터가 없습니다.";
    grid.appendChild(p);
    return;
  }

  list.forEach((m) => {
    const item = document.createElement("div");
    item.className = "micro-item";

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = m.name ?? "-";

    const status = document.createElement("div");
    status.className = "status";
    const level = m.level ?? levelFromRatio(m.ratio);
    status.textContent = `충족도: ${level}`;

    const bar = document.createElement("div");
    bar.className = "progress";
    const fill = document.createElement("span");
    const ratio = clamp01(Number(m.ratio ?? 0));
    fill.style.width = `${(ratio * 100).toFixed(0)}%`;
    bar.appendChild(fill);

    item.appendChild(name);
    item.appendChild(status);
    item.appendChild(bar);
    grid.appendChild(item);
  });
}

/* ------------------- 유틸 ------------------- */
function el(tag, attrs) {
  const n = document.createElementNS("http://www.w3.org/2000/svg", tag);
  if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
}
function polar(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function getCSS(v) {
  return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
}
function toComma(n) {
  return (Number(n) || 0).toLocaleString("ko-KR");
}
function clamp01(x) {
  x = Number(x) || 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}
function levelFromRatio(r) {
  const v = clamp01(Number(r || 0));
  if (v >= 0.8) return "상";
  if (v >= 0.5) return "중";
  return "하";
}
function setText(id, txt) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(txt ?? "");
}
function clearNode(node) {
  if (!node) return;
  while (node.firstChild) node.removeChild(node.firstChild);
}
function todayStr() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
function getDateFromURL() {
  try {
    const u = new URL(location.href);
    return u.searchParams.get("date");
  } catch {
    return null;
  }
}
function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

/* 확대 방지 (모바일 제스처) */
function preventZoom() {
  window.addEventListener(
    "gesturestart",
    (e) => e.preventDefault(),
    { passive: false }
  );
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
