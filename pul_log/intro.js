/* ===== 설정 ===== */
const NEXT_URL = "survey.html"; // 인트로 후 이동할 페이지 (원하는 파일로 변경)

/* ===== DOM 준비 ===== */
document.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("show");

  // 화면 터치 시 -> 페이드아웃 후 이동
  document.addEventListener("click", handleNext, { once: true });
  document.addEventListener("touchend", handleNext, { once: true });

  // 모바일 확대 제한
  preventZoom();
});

/* ===== 이벤트 ===== */
function handleNext() {
  document.body.classList.add("out");

  // 페이드아웃 시간 읽기
  const outMs = readMsFromCSS("--out", 600);
  setTimeout(() => safeGo(NEXT_URL), outMs);
}

/* ===== 유틸 ===== */
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
  } catch {
    /* noop */
  }
}

/* 확대 제한(핀치/더블탭/ctrl+휠) */
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
