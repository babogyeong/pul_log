/* ===== 설정 ===== */
const NEXT_URL = "../intro/intro.html"; // 온보딩 후 이동할 페이지 (필요 시 변경)
const HOLD_MS = getComputedStyle(document.documentElement)
  .getPropertyValue("--hold")
  .trim();

/* ===== 진입 시 애니메이션 시작 ===== */
document.addEventListener("DOMContentLoaded", () => {
  document.documentElement.classList.add("js"); // 가능 확인용
  document.body.classList.add("show");

  const hold = parseTimeMs(HOLD_MS) ?? 3000;

  // 지정 시간 후 페이드아웃 시작
  window.setTimeout(() => {
    document.body.classList.add("out");

    // 애니메이션이 끝나면 페이지 이동
    const durationOut = msFromVar("--duration-out", 600);
    window.setTimeout(() => safeNavigate(NEXT_URL), durationOut);
  }, hold);

  // 모바일 확대(핀치/더블탭) 제한
  preventZoom();
});

/* ===== 유틸 ===== */
function msFromVar(cssVarName, fallback) {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(cssVarName)
    .trim();
  return parseTimeMs(v) ?? fallback;
}
function parseTimeMs(val) {
  if (!val) return null;
  if (val.endsWith("ms")) return Number(val.replace("ms", "").trim());
  if (val.endsWith("s"))
    return Math.round(Number(val.replace("s", "").trim()) * 1000);
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
}

function safeNavigate(url) {
  try {
    window.location.assign(url);
  } catch {
    /* noop */
  }
}

/* 확대 제한: iOS/안드로이드 공통 대응 */
function preventZoom() {
  // 제스처(핀치) 차단
  window.addEventListener("gesturestart", (e) => e.preventDefault(), {
    passive: false,
  });

  // 더블탭 확대 방지
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

  // 키보드 Ctrl/Meta + 휠 확대 방지(데스크톱 브라우저)
  window.addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    },
    { passive: false }
  );
}
