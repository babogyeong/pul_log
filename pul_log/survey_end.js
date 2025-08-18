/* ===== 설정 ===== */
const NEXT_URL = "main.html"; // 다음 페이지로 이동할 경로로 바꾸세요

/* ===== DOM 준비 ===== */
document.addEventListener("DOMContentLoaded", () => {
  // 이름 로드
  const name = readNameFromStorage();
  const nameSpan = document.getElementById("username");
  nameSpan.textContent = name || "OO";

  // 등장
  document.body.classList.add("show");

  // 터치/클릭 시 퇴장 → 이동
  const go = () => {
    document.body.classList.add("out");
    const outMs = readMsFromCSS("--out", 600);
    setTimeout(() => safeGo(NEXT_URL), outMs);
  };
  document.addEventListener("click", go, { once: true });
  document.addEventListener("touchend", go, { once: true });

  // 확대 제한
  preventZoom();
});

/* ===== 유틸 ===== */
function readNameFromStorage() {
  try {
    // 이전 설문 코드에서 저장한 키와 동일하게 사용
    const raw = localStorage.getItem("surveyData");
    if (!raw) return "";
    const obj = JSON.parse(raw);
    const n = String(obj?.name || "").trim();
    // 간단한 마스킹/클린업(공백 제거)
    return n || "";
  } catch {
    return "";
  }
}
function readMsFromCSS(varName, fallback) {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  if (!v) return fallback;
  if (v.endsWith("ms")) return Number(v.replace("ms", "").trim());
  if (v.endsWith("s"))
    return Math.round(Number(v.replace("s", "").trim()) * 1000);
  const num = Number(v);
  return Number.isFinite(num) ? num : fallback;
}
function safeGo(url) {
  try {
    window.location.assign(url);
  } catch {}
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
