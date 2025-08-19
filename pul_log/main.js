/* ============ 대화 영구 저장 ============ */
/*  drop-in replacement for main.js  */

document.addEventListener("DOMContentLoaded", () => {
  const messages = document.getElementById("messages");
  const form = document.getElementById("form");
  const input = document.getElementById("input");
  const sendBtn = document.getElementById("sendBtn");

  const STORAGE_KEY = "chatHistory.v1"; // 저장  키
  const MAX_ITEMS = 200; // 보관 최대 메시지 수

  // 메모리 내 히스토리
  let history = loadHistory();

  // 화면에 복원 렌더
  renderHistory(history);

  // 히스토리 없을 때만 안내 버블 등장
  if (history.length === 0) showTip();

  // 입력 자동 리사이즈
  autoResizeTextarea(input);

  // 폼 기본 제출 막기
  form.addEventListener("submit", (e) => e.preventDefault());

  // IME(조합) 상태 추적 (한글 등)
  let composing = false;
  input.addEventListener("compositionstart", () => (composing = true));
  input.addEventListener("compositionend", () => (composing = false));

  // Enter → 전송 (조합 중일 땐 무시)
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !composing && !e.isComposing) {
      e.preventDefault();
      sendCurrent();
    }
  });

  // 버튼 클릭 → 전송
  sendBtn.addEventListener("click", sendCurrent);

  // 다른 탭에서 수정되면 동기화
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      history = loadHistory();
      clearMessages();
      renderHistory(history);
      if (history.length === 0) showTip();
    }
  });

  // iOS 키보드/뷰포트 대응 & 확대 제한
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

    // 입력창 즉시 초기화(아이폰 잔상 방지 포함)
    clearInputHard(input);

    // 사용자 메시지 추가 + 저장
    addMessage({ role: "user", text });

    // ▼ 추후 API 연결 위치 ▼
    // sendToAssistant(text)
    //   .then((ans) => addMessage({ role: "assistant", text: ans }))
    //   .finally(() => (sending = false));

    // 임시 예시 응답
    setTimeout(() => {
      addMessage({
        role: "assistant",
        text: "아직 AI 연결 전이라 예시 응답입니다.",
      });
      sending = false;
    }, 250);
  }

  /* ---------- 메시지 추가 & 저장 ---------- */
  function addMessage(msg) {
    // DOM 렌더
    renderMessage(msg);

    // 메모리/스토리지 반영
    history.push({ role: msg.role, text: msg.text, ts: Date.now() });
    persistHistory(history);
  }

  /* ---------- 렌더링 ---------- */
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
    bubble.textContent = m.text; // XSS 안전: textContent

    wrap.appendChild(bubble);
    messages.appendChild(wrap);

    requestAnimationFrame(() => bubble.classList.add("show"));
  }

  function clearMessages() {
    // tip은 유지(필요 시 다시 붙이기 위해) → msg만 제거
    messages.querySelectorAll(".msg").forEach((n) => n.remove());
  }

  /* ---------- 저장/복원 ---------- */
  function persistHistory(list) {
    try {
      // 오래된 것부터 잘라서 저장
      const trimmed = list.slice(-MAX_ITEMS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch (err) {
      // 용량 초과 시 가장 오래된 절반 제거 후 재시도
      try {
        const trimmed = list.slice(-Math.floor(MAX_ITEMS / 2));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
        history = trimmed;
      } catch {}
    }
  }

  function loadHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      // 포맷 검증
      return arr
        .filter(
          (m) =>
            m &&
            typeof m.text === "string" &&
            (m.role === "user" || m.role === "assistant")
        )
        .slice(-MAX_ITEMS);
    } catch {
      return [];
    }
  }

  /* ---------- 보조 UI ---------- */
  function showTip() {
    const tip = messages.querySelector(".tip");
    if (tip) requestAnimationFrame(() => tip.classList.add("show"));
  }
});

/* ============== 공용 유틸 ============== */
function autoResizeTextarea(el) {
  const resize = () => {
    el.style.height = "auto";
    el.style.height =
      Math.min(el.scrollHeight, window.innerHeight * 0.28) + "px";
  };
  el.addEventListener("input", resize);
  resize();
}

function clearInputHard(el) {
  // 1) 값 제거
  el.value = "";
  // 2) 높이 재계산
  autoResizeTextarea(el);
  // 3) iOS 예측 글자 커밋 잔상을 미세 지연으로 한 번 더 제거
  queueMicrotask(() => {
    el.value = "";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function scrollToBottom(container) {
  container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
}

function setupViewportInsets() {
  if (!window.visualViewport) return;
  const root = document.documentElement;
  const onResize = () => {
    const vv = window.visualViewport;
    root.style.setProperty("--vvh", vv.height + "px");
  };
  window.visualViewport.addEventListener("resize", onResize);
  onResize();
}

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

/* ==== (참고) API 연결 예시 ==== 
async function sendToAssistant(userText){
  const res = await fetch('/api/chat', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ message: userText })
  });
  if(!res.ok) throw new Error('network');
  const data = await res.json();
  return data.reply ?? '(응답 없음)';
}
*/
