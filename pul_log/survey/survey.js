/* ===== 설정 ===== */
const NEXT_URL = "../survey_end/survey_end.html"; // 완료 후 이동할 페이지
const API_ENDPOINT = "https://fh5zli5lvi.execute-api.us-east-1.amazonaws.com/prod/manageProfile"; // 서버 없으면 로컬스토리지 백업
const USER_ID = "abcd123456-789"; // report.js와 동일한 고정 사용자 ID

/* ===== 엘리먼트 ===== */
const track = document.getElementById("track");
const dots = Array.from(document.querySelectorAll(".pager .dot"));
const submitBtn = document.getElementById("submitBtn");

/* ===== 상태 ===== */
let index = 0;
const total = 3;

/* ===== 초기화 ===== */
document.addEventListener("DOMContentLoaded", () => {
  // 스냅 스크롤 후 인덱스 동기화
  track.addEventListener("scroll", onScroll, { passive: true });

  // 칩 로직
  initChips();

  // 완료
  submitBtn.addEventListener("click", onSubmit);

  // 확대 제한
  preventZoom();

  // 최초 동기화
  syncPager();
});

/* ===== 스크롤 → 인덱스 동기화 ===== */
let rafId = null;
function onScroll() {
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = null;
    const w = track.clientWidth;
    const i = Math.round(track.scrollLeft / w);
    if (i !== index) {
      index = Math.max(0, Math.min(total - 1, i));
      syncPager();
    }
  });
}
function syncPager() {
  dots.forEach((d, i) => d.classList.toggle("active", i === index));
  submitBtn.classList.toggle("hidden", index !== total - 1);
}

/* ===== 칩 선택 로직 =====
  - radiogroup(성별, 식습관): 단일선택
  - group + data-none(질병, 알러지): 다중선택, 단 '해당없음' 클릭 시 그 그룹은 단일선택
*/
function initChips() {
  document.querySelectorAll(".chips").forEach((group) => {
    group.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip");
      if (!btn) return;

      const name = btn.dataset.name;
      const chips = Array.from(
        group.querySelectorAll(`.chip[data-name="${name}"]`)
      );
      const isNone = btn.hasAttribute("data-none");
      const isRadio = group.getAttribute("role") === "radiogroup";

      if (isRadio) {
        chips.forEach((c) => {
          const on = c === btn;
          c.classList.toggle("is-selected", on);
          c.setAttribute("aria-checked", on ? "true" : "false");
        });
        return;
      }

      if (isNone) {
        chips.forEach((c) => {
          const on = c === btn;
          c.classList.toggle("is-selected", on);
          c.setAttribute("aria-checked", on ? "true" : "false");
        });
        return;
      }

      // 일반 칩 토글
      btn.classList.toggle("is-selected");
      btn.setAttribute(
        "aria-checked",
        btn.classList.contains("is-selected") ? "true" : "false"
      );

      // none 선택돼 있으면 해제
      const noneChip = chips.find((c) => c.hasAttribute("data-none"));
      if (noneChip) {
        noneChip.classList.remove("is-selected");
        noneChip.setAttribute("aria-checked", "false");
      }
    });
  });
}

/* ===== 제출 ===== */
async function onSubmit() {
  const data = collectData();
  const missing = validate(data);
  if (missing.length) {
    alert(`다음 항목을 확인해주세요:\n- ${missing.join("\n- ")}`);
    return;
  }

  let ok = false;
  try {
    const res = await fetch(API_ENDPOINT, {
      mode: "cors",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        // (추가) 사용자 ID를 헤더에 담아 전송
        "x-user-id": USER_ID,
      },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      // 성공 시 다음 페이지로 이동
      window.location.assign(NEXT_URL);
    } else {
      // 서버에서 4xx, 5xx 에러를 반환한 경우
      const errorData = await res
        .json()
        .catch(() => ({ message: "알 수 없는 오류" }));
      throw new Error(errorData.message || "서버에서 오류가 발생했습니다.");
    }
  } catch (error) {
    // 네트워크 오류 또는 위에서 발생시킨 에러 처리
    alert(
      `전송에 실패했어요. 네트워크 상태를 확인해주세요.\n(${error.message})`
    );
    // 로딩 상태 해제
    submitBtn.disabled = false;
    submitBtn.textContent = "완료";
  }
}

/* ===== 데이터 수집 & 검증 ===== */
function collectData() {
  const v = (id) => document.getElementById(id)?.value?.trim() ?? "";
  const pickSingle = (name) =>
    document.querySelector(`.chip.is-selected[data-name="${name}"]`)?.dataset
      ?.value ?? "";
  const pickMulti = (name) =>
    Array.from(
      document.querySelectorAll(`.chip.is-selected[data-name="${name}"]`)
    ).map((c) => c.dataset.value);

  return {
    name: v("name"),
    age: Number(v("age")),
    height: Number(v("height")),
    weight: Number(v("weight")),
    gender: pickSingle("gender"),
    diseases: pickMulti("diseases"),
    allergies: pickMulti("allergies"),
    dietType: pickSingle("dietType"),
    ts: Date.now(),
  };
}
function validate(d) {
  const errs = [];
  if (!d.name) errs.push("이름");
  if (!Number.isFinite(d.age) || d.age <= 0) errs.push("나이");
  if (!Number.isFinite(d.height) || d.height <= 0) errs.push("키");
  if (!Number.isFinite(d.weight) || d.weight <= 0) errs.push("몸무게");
  if (!d.gender) errs.push("성별");
  if (!d.dietType) errs.push("식습관 타입");
  return errs;
}

/* ===== 확대 제한 ===== */
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

/* ===== 알러지 아코디언 ===== */
document.addEventListener("DOMContentLoaded", () => {
  const accordions = document.querySelectorAll(".accordion");

  accordions.forEach((acc) => {
    const header = acc.querySelector(".accordion-header");
    const panel = acc.querySelector(".accordion-panel");

    header.addEventListener("click", () => {
      const isOpen = header.classList.contains("active");

      if (isOpen) {
        // 닫기: 현재 높이에서 0으로
        panel.style.maxHeight = panel.scrollHeight + "px"; // 현재 높이 고정
        requestAnimationFrame(() => {
          panel.style.maxHeight = "0";
        });
        header.classList.remove("active");
        panel.classList.remove("open");
      } else {
        // 열기: scrollHeight까지 부드럽게
        header.classList.add("active");
        panel.classList.add("open");
        panel.style.maxHeight = panel.scrollHeight + "px";
      }
    });

    // 패널 안의 내용이 변해도 자연스럽게 높이 갱신
    const resizeObserver = new ResizeObserver(() => {
      if (panel.classList.contains("open")) {
        panel.style.maxHeight = panel.scrollHeight + "px";
      }
    });
    resizeObserver.observe(panel);
  });
});

