/* ==================================
 * 채팅 (main.js) - 서버 연동 버전
 * ================================== */

document.addEventListener("DOMContentLoaded", async () => { /* 'async' 추가 */
  /* ===== 설정 (ADDED) ===== */
  // 백엔드 Lambda와 연결된 API Gateway 엔드포인트 URL로 변경하세요.
  const CHAT_API_URL = "https://your-api-gateway-id.execute-api.region.amazonaws.com/prod/manageChatHistory";
  const USER_ID = "abcd123456-789"; // 다른 파일과 동일한 사용자 ID

  /* ===== 엘리먼트 ===== */
  const messages = document.getElementById("messages");
  const form = document.getElementById("form");
  const input = document.getElementById("input");
  const sendBtn = document.getElementById("sendBtn");

  // 메모리 내 히스토리 (초기에는 비어있음)
  let history = [];

  // (CHANGED) 서버에서 기록을 비동기로 불러와 렌더링
  try {
    history = await loadHistoryFromServer();
    renderHistory(history);
  } catch (error) {
    console.error("Failed to load chat history:", error);
    addMessage({ role: "assistant", text: "이전 대화 기록을 불러오는 데 실패했습니다." });
  }

  // 히스토리 없을 때만 안내 버블 등장
  if (history.length === 0) showTip();

  // 기존 이벤트 리스너들 (변경 없음)
  autoResizeTextarea(input);
  form.addEventListener("submit", (e) => e.preventDefault());
  let composing = false;
  input.addEventListener("compositionstart", () => (composing = true));
  input.addEventListener("compositionend", () => (composing = false));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !composing && !e.isComposing) {
      e.preventDefault();
      sendCurrent();
    }
  });
  sendBtn.addEventListener("click", sendCurrent);
  setupViewportInsets();
  preventZoom();

  // 중복 전송 방지 락
  let sending = false;

  /* ---------- 전송 ---------- */
  function sendCurrent() {
    if (sending) return;
    const text = (input.value || "").trim();
    if (!text) return;

    sending = true;
    clearInputHard(input);

    // 사용자 메시지 추가 (UI에 즉시 표시)
    const userMsg = { role: "user", text, ts: Date.now() };
    addMessage(userMsg);

    // (CHANGED) 챗봇 응답 및 서버 통신 로직
    sendToAssistant(text)
        .then(ans => {
          const assistantMsg = { role: "assistant", text: ans, ts: Date.now() };
          addMessage(assistantMsg);
        })
        .catch(e => {
          const errorMsg = { role: "assistant", text: "통신 오류: " + String(e.message || e) };
          addMessage(errorMsg);
        })
        .finally(() => (sending = false));
  }

  // (CHANGED) 챗봇 API 호출 로직은 기존과 동일 (chat_create 사용)
  async function sendToAssistant(userText) {
    const res = await fetch("https://fh5zli5lvi.execute-api.us-east-1.amazonaws.com/prod/chat_create", {
      mode: "cors",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": USER_ID,
      },
      body: JSON.stringify({ text: userText }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`API ${res.status}: ${errText || "network error"}`);
    }
    const payload = await res.json();
    return payload.message || "(응답 없음)";
  }

  /* ---------- 메시지 추가 & 저장 ---------- */
  function addMessage(msg) {
    // 1. DOM 렌더링 (즉시)
    renderMessage(msg);

    // 2. 메모리에 반영
    history.push(msg);

    // 3. (CHANGED) 서버에 메시지 저장 (백그라운드)
    saveMessageToServer(msg).catch(error => {
      console.error("Failed to save message to server:", error);
      // 필요 시, 저장 실패에 대한 UI 피드백 추가 가능
    });
  }

  /* ---------- 렌더링 (변경 없음) ---------- */
  function renderHistory(list) {
    const tip = messages.querySelector(".tip");
    if (tip) tip.remove();
    list.forEach((m) => renderMessage(m));
    scrollToBottom(messages);
  }

  function renderMessage(m) {
    const wrap = document.createElement("div");
    wrap.className = `msg ${m.role === "user" ? "user" : "assistant"}`;
    const bubble = document.createElement("div");
    bubble.className = `bubble ${m.role === "user" ? "user" : "assistant"}`;
    bubble.textContent = m.text;
    wrap.appendChild(bubble);
    messages.appendChild(wrap);
    requestAnimationFrame(() => bubble.classList.add("show"));
  }

  /* ---------- (CHANGED) 서버 통신 함수들 ---------- */
  async function loadHistoryFromServer() {
    const res = await fetch(CHAT_API_URL, {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Accept': 'application/json',
        'x-user-id': USER_ID,
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch history with status ${res.status}`);
    }
    const data = await res.json();
    // Lambda 응답이 body에 래핑되어 있을 경우를 대비
    const historyData = typeof data.body === 'string' ? JSON.parse(data.body) : data;
    return Array.isArray(historyData) ? historyData : [];
  }

  async function saveMessageToServer(msg) {
    // 서버에는 역할, 텍스트, 타임스탬프만 전송
    const payload = {
      role: msg.role,
      text: msg.text,
      ts: msg.ts,
    };
    await fetch(CHAT_API_URL, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': USER_ID,
      },
      body: JSON.stringify(payload),
    });
  }

  /* ---------- 보조 UI (변경 없음) ---------- */
  function showTip() {
    const tip = messages.querySelector(".tip");
    if (tip) requestAnimationFrame(() => tip.classList.add("show"));
  }
});

/* ============== 공용 유틸 (기존과 동일) ============== */
function autoResizeTextarea(el) { /* ... */ }
function clearInputHard(el) { /* ... */ }
function scrollToBottom(container) { /* ... */ }
function setupViewportInsets() { /* ... */ }
function preventZoom() { /* ... */ }

// 공용 유틸 함수들의 내용은 기존 파일에서 복사하여 붙여넣으세요.