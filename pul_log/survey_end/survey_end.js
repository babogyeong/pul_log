/* ===========================
 * survey_end.js 전체 코드
 * =========================== */

/* ===== 설정 ===== */
const NEXT_URL = "main.html"; // 다음 페이지
const API_ENDPOINT = "https://fh5zli5lvi.execute-api.us-east-1.amazonaws.com/prod/manageProfile"; // survey.js와 동일
const USER_ID = "abcd123456-789"; // survey.js와 동일

/* ===== DOM 준비 ===== */
document.addEventListener("DOMContentLoaded", () => {
  // DB에서 사용자 이름을 비동기로 불러와서 화면에 표시
  loadAndRenderName();

  // 등장 애니메이션
  document.body.classList.add("show");

  // 터치/클릭 시 퇴장 후 이동
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

/* ===== 데이터 로딩 및 렌더링 ===== */
async function loadAndRenderName() {
  const nameSpan = document.getElementById("username");
  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'GET',
      mode: 'cors',
      headers: {
        "Accept": "application/json",
        "x-user-id": USER_ID
      }
    });

    if (!res.ok) {
      // 사용자를 찾지 못했거나 서버 오류가 발생한 경우
      nameSpan.textContent = "방문자"; // 기본값
      return;
    }

    const data = await res.json();
    const name = String(data?.name || "").trim();
    nameSpan.textContent = name || "방문자";

  } catch (error) {
    // 네트워크 오류 등
    console.error("Failed to fetch user name:", error);
    nameSpan.textContent = "방문자"; // 에러 시 기본값
  }
}

/* ===== 기존 유틸 함수들 (변경 없음) ===== */
function readMsFromCSS(varName, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  if (!v) return fallback;
  if (v.endsWith("ms")) return Number(v.replace("ms", "").trim());
  if (v.endsWith("s")) return Math.round(Number(v.replace("s", "").trim()) * 1000);
  const num = Number(v);
  return Number.isFinite(num) ? num : fallback;
}
function safeGo(url) {
  try { window.location.assign(url); } catch {}
}
function preventZoom() {
  window.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });
  let lastTouchEnd = 0;
  document.addEventListener("touchend", (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 350) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });
  window.addEventListener("wheel", (e) => {
    if (e.ctrlKey || e.metaKey) e.preventDefault();
  }, { passive: false });
}