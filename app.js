
/* ==========================================
   리틀팍스 동화 레벨 2
   TXT: data/w01.txt ~ data/w67.txt
   MP3: s67/s01.mp3 ~ s67/s67.mp3
========================================== */

const TOTAL_STORIES = 67;
const DATA_DIR = "./data/";
const AUDIO_DIR = "./s67/";
const STORAGE_KEY = "littlefox_level2_completed";

let stories = [];
let currentStory = 1;
let currentRange = "1-20";
let currentMode = "both";

const audio = new Audio();

const $ = id => document.getElementById(id);

const ranges = {
  "1-20": [1, 20],
  "21-40": [21, 40],
  "41-60": [41, 60],
  "61-67": [61, 67]
};

let completed = new Set();

try {
  completed = new Set(
    JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")
  );
} catch (error) {
  completed = new Set();
}

/* TXT 파일 하나 불러오기 */
async function loadOneStory(number) {
  const filename = `w${String(number).padStart(2, "0")}.txt`;

  const response = await fetch(DATA_DIR + filename, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(
      `${filename} 파일을 불러오지 못했습니다.\n` +
      `GitHub의 data 폴더에 해당 파일이 있는지 확인해 주세요.`
    );
  }

  const text = (await response.text()).replace(/^\uFEFF/, "");

  return parseStory(text, number);
}

/* TXT 제목과 본문 분석 */
function parseStory(text, number) {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);

  let title = `동화 ${number}`;
  let koreanTitle = "";
  let waitingForKoreanTitle = false;
  const content = [];

  for (const line of lines) {
    const titleMatch = line.match(/^제목:\s*(.+)$/);

    if (titleMatch) {
      title = titleMatch[1].trim();
      waitingForKoreanTitle = true;
      continue;
    }

    /* 제목 바로 다음 줄의 한국어 제목 */
    if (waitingForKoreanTitle) {
      waitingForKoreanTitle = false;

      const koreanMatch = line.match(/^[（(](.*)[）)]$/);

      if (koreanMatch) {
        koreanTitle = koreanMatch[1].trim();
        continue;
      }

      if (/^[가-힣\s]+$/.test(line) && !/[.!?]/.test(line)) {
        koreanTitle = line;
        continue;
      }
    }

    /* 안내문과 저작권 문구 제외 */
    if (
      /학습자료|원문해석|글자 확대|글자 축소|인쇄/.test(line) ||
      /원문 내용 중 단어를 클릭하면/.test(line) ||
      /원문 숨기기|원문 보이기/.test(line) ||
      /All rights reserved|www\.littlefox\.co\.kr|©\s*2000-2026/i.test(line)
    ) {
      continue;
    }

    /* 영어와 한국어 문장 분류 */
    if (/[a-zA-Z]/.test(line)) {
      content.push({ text: line, lang: "en" });
    } else if (/[가-힣]/.test(line)) {
      content.push({ text: line, lang: "ko" });
    }
  }

  return {
    id: number,
    title,
    koreanTitle,
    lines: content
  };
}

/* 67편 불러오기 */
async function loadAllStories() {
  const results = await Promise.all(
    Array.from(
      { length: TOTAL_STORIES },
      (_, index) => loadOneStory(index + 1)
    )
  );

  stories = results;
}

/* 메인 화면과 진행률 */
function updateProgress() {
  const count = completed.size;
  const percent = Math.round(count / TOTAL_STORIES * 100);

  if ($("progressCount")) {
    $("progressCount").textContent = `${count} / ${TOTAL_STORIES}`;
  }

  if ($("progressBar")) {
    $("progressBar").style.width = `${percent}%`;
    $("progressBar").setAttribute("aria-valuenow", count);
  }

  if ($("progressPercent")) {
    $("progressPercent").textContent = `${percent}%`;
  }
}

/* 화면 전환 */
function showView(viewId) {
  ["homeView", "listView", "studyView"].forEach(id => {
    const view = $(id);
    if (view) view.hidden = id !== viewId;
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* 구간 선택 */
function selectRange(range) {
  if (!ranges[range]) return;

  currentRange = range;

  const [start, end] = ranges[range];

  if ($("rangeTitle")) {
    $("rangeTitle").textContent = `${start}~${end}번 동화 목록`;
  }

  renderStoryList();
  showView("listView");
}

/* 동화 목록 표시 */
function renderStoryList() {
  const list = $("storyList");
  if (!list) return;

  list.innerHTML = "";

  const [start, end] = ranges[currentRange];

  stories
    .filter(story => story.id >= start && story.id <= end)
    .forEach(story => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "story-item";

      if (completed.has(story.id)) {
        button.classList.add("completed");
      }

      const number = document.createElement("span");
      number.className = "story-number";
      number.textContent = story.id;

      const title = document.createElement("span");
      title.className = "story-title";
      title.textContent = story.title;

      button.append(number, title);

      if (completed.has(story.id)) {
        const check = document.createElement("span");
        check.className = "story-check";
        check.textContent = "✓";
        button.appendChild(check);
      }

      button.addEventListener("click", () => openStory(story.id));

      list.appendChild(button);
    });

  document.querySelectorAll("[data-range]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.range === currentRange
    );
  });
}

/* 동화 제목 표시 */
function getFullTitle(story) {
  return story.koreanTitle
    ? `${story.title} (${story.koreanTitle})`
    : story.title;
}

/* 동화 열기 */
function openStory(number) {
  const story = stories.find(item => item.id === number);
  if (!story) return;

  currentStory = number;
  currentMode = "both";

  showView("studyView");

  if ($("studyTitle")) {
    $("studyTitle").textContent =
      `${story.id}. ${getFullTitle(story)}`;
  }

  renderStoryContent(story);
  updateCompleteButton();
  updateNavigation();

  if ($("audioTitle")) {
    $("audioTitle").textContent =
      `${story.id}. ${story.title}`;
  }

  /* 번호에 맞는 음성 연결 */
  audio.pause();
  audio.currentTime = 0;
  audio.src =
    `${AUDIO_DIR}s${String(number).padStart(2, "0")}.mp3`;

  audio.playbackRate = Number($("speedSelect")?.value || 1);
  audio.load();

  updateAudioProgress();
}

/* 영어 / 한국어 / 함께 보기 */
function renderStoryContent(story) {
  const body = $("storyContent");
  if (!body) return;

  body.innerHTML = "";

  story.lines
    .filter(line =>
      currentMode === "both" || line.lang === currentMode
    )
    .forEach(line => {
      const p = document.createElement("p");

      p.className = line.lang === "en"
        ? "story-line english-line"
        : "story-line korean-line";

      p.textContent = line.text;
      body.appendChild(p);
    });

  document.querySelectorAll("[data-mode]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.mode === currentMode
    );
  });
}

/* 완료 체크 버튼 */
function updateCompleteButton() {
  const button = $("completeButton");
  if (!button) return;

  const isCompleted = completed.has(currentStory);

  button.textContent = isCompleted
    ? "✓ 학습 완료됨 (다시 누르면 해제)"
    : "✓ 학습 완료 체크 저장";

  button.classList.toggle("saved", isCompleted);
}

/* 완료 상태 저장 */
function toggleComplete() {
  if (completed.has(currentStory)) {
    completed.delete(currentStory);
  } else {
    completed.add(currentStory);
  }

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([...completed])
  );

  updateProgress();
  updateCompleteButton();
  renderStoryList();
}

/* 이전 / 다음 동화 */
function updateNavigation() {
  if ($("prevButton")) {
    $("prevButton").disabled = currentStory <= 1;
  }

  if ($("nextButton")) {
    $("nextButton").disabled = currentStory >= TOTAL_STORIES;
  }
}

/* 오디오 재생 */
async function playAudio() {
  if (!audio.src) {
    alert("먼저 동화를 선택해 주세요.");
    return;
  }

  try {
    await audio.play();
  } catch (error) {
    console.error("오디오 재생 오류:", error);

    alert(
      "오디오를 재생할 수 없습니다.\n\n" +
      `파일 주소: ${audio.src}\n\n` +
      "s67 폴더의 MP3 파일명을 확인해 주세요."
    );
  }
}

/* 오디오 정지 */
function stopAudio() {
  audio.pause();
  audio.currentTime = 0;
  updateAudioProgress();
}

/* 시간 표시 */
function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";

  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

/* 오디오 진행 막대 */
function updateAudioProgress() {
  if ($("currentTime")) {
    $("currentTime").textContent = formatTime(audio.currentTime);
  }

  if ($("durationTime")) {
    $("durationTime").textContent = formatTime(audio.duration);
  }

  if ($("audioProgress")) {
    $("audioProgress").value = audio.duration > 0
      ? audio.currentTime / audio.duration * 100
      : 0;
  }
}

/* 버튼 연결 */
function bindEvents() {
  document.querySelectorAll("[data-range]").forEach(button => {
    button.addEventListener("click", () => {
      selectRange(button.dataset.range);
    });
  });

  $("homeButton")?.addEventListener("click", () => {
    audio.pause();
    showView("homeView");
  });

  $("listButton")?.addEventListener("click", () => {
    audio.pause();
    renderStoryList();
    showView("listView");
  });

  document.querySelectorAll("[data-mode]").forEach(button => {
    button.addEventListener("click", () => {
      currentMode = button.dataset.mode;

      const story = stories.find(item => item.id === currentStory);
      if (story) renderStoryContent(story);
    });
  });

  $("completeButton")?.addEventListener("click", toggleComplete);

  $("prevButton")?.addEventListener("click", () => {
    if (currentStory > 1) openStory(currentStory - 1);
  });

  $("nextButton")?.addEventListener("click", () => {
    if (currentStory < TOTAL_STORIES) openStory(currentStory + 1);
  });

  $("playButton")?.addEventListener("click", playAudio);
  $("stopButton")?.addEventListener("click", stopAudio);

  $("speedSelect")?.addEventListener("change", event => {
    audio.playbackRate = Number(event.target.value);
  });

  $("audioProgress")?.addEventListener("input", event => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime =
        Number(event.target.value) / 100 * audio.duration;
    }
  });

  audio.addEventListener("timeupdate", updateAudioProgress);
  audio.addEventListener("loadedmetadata", updateAudioProgress);
  audio.addEventListener("ended", updateAudioProgress);

  audio.addEventListener("error", () => {
    console.error("MP3 파일 로딩 실패:", audio.src);
  });
}

/* 앱 시작 */
async function initApp() {
  bindEvents();
  updateProgress();
  showView("homeView");

  try {
    await loadAllStories();

    console.log(`동화 ${stories.length}/${TOTAL_STORIES}편을 불러왔습니다.`);

    if ($("errorMessage")) {
      $("errorMessage").hidden = true;
      $("errorMessage").textContent = "";
    }
  } catch (error) {
    console.error("동화 데이터 로딩 오류:", error);

    if ($("errorMessage")) {
      $("errorMessage").hidden = false;
      $("errorMessage").textContent = error.message;
    }
  }
}

document.addEventListener("DOMContentLoaded", initApp);
