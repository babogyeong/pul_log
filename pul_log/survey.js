/* ===== 설정 ===== */
const NEXT_URL = "survey_end.html"; // 완료 후 이동할 페이지
const API_ENDPOINT = "https://fh5zli5lvi.execute-api.us-east-1.amazonaws.com/prod/manageProfile"; // 서버 없으면 로컬스토리지 백업

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
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(data),
    });
    ok = res.ok;
  } catch {
    ok = false;
  }

  if (!ok) {
    try {
      localStorage.setItem("surveyData", JSON.stringify(data));
      ok = true;
    } catch {}
  }

  if (ok) window.location.assign(NEXT_URL);
  else alert("전송에 실패했어요. 네트워크 상태를 확인해주세요.");
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
