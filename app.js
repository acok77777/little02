
/* =========================================
   리틀팍스 동화 레벨 2 - app.js
   동화 67편 / 영어·한국어 학습 / 오디오
========================================= */

const TOTAL_STORIES = 67;
const AUDIO_DIR = "./s67/";

const DATA_FILES = [
  "./data/story67.txt",
  "./데이터/story67.txt",
  "./story67.txt",
  "./메모장w67.txt",
  "./data/메모장w67.txt"
];

const $ = (id) => document.getElementById(id);

let stories = [];
let currentStory = 1;
let currentMode = "both";
let currentRange = "1-20";
let audio = new Audio();
let audioReady = false;

/* =========================================
   학습 완료 상태 저장
========================================= */

const PROGRESS_KEY = "little02_completed_stories";

function getCompletedStories() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(PROGRESS_KEY) || "[]"
    );

    return new Set(
      Array.isArray(saved) ? saved.map(Number) : []
    );
  } catch (error) {
    return new Set();
  }
}

let completedStories = getCompletedStories();

function saveCompletedStories() {
  localStorage.setItem(
    PROGRESS_KEY,
    JSON.stringify([...completedStories])
  );
}

/* =========================================
   화면 전환
========================================= */

function showView(viewId) {
  const viewIds = ["homeView", "listView", "studyView"];

  viewIds.forEach((id) => {
    const el = $(id);

    if (el) {
      el.hidden = id !== viewId;
      el.style.display = id === viewId ? "" : "none";
    }
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* =========================================
   TXT 파일 불러오기
========================================= */

async function loadStoryText() {
  let lastError = null;

  for (const path of DATA_FILES) {
    try {
      const response = await fetch(path, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(`${path} 파일을 불러오지 못했습니다.`);
      }

      const text = await response.text();

      if (text.trim()) {
        return text.replace(/^\uFEFF/, "");
      }
    } catch (error) {
      lastError = error;
      console.warn("데이터 파일 확인:", path, error);
    }
  }

  throw new Error(
    "story67.txt 파일을 찾지 못했습니다. " +
    "파일 위치와 이름을 확인해 주세요. " +
    (lastError ? lastError.message : "")
  );
}

/* =========================================
   언어 판별
========================================= */

function detectLanguage(text) {
  if (/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(text)) return "ko";
  if (/[a-zA-Z]/.test(text)) return "en";
  return "other";
}

/* =========================================
   불필요한 웹페이지 문구 제거
========================================= */

function isPageInstruction(line) {
  const text = line.trim();

  if (!text) return true;
  if (/^\[L\d+\]/.test(text)) return true;

  const ignoredExact = [
    "학습자료",
    "원문해석",
    "글자 확대",
    "글자 축소",
    "인쇄",
    "원문 숨기기",
    "원문 보이기",
    "해석 숨기기",
    "해석 보이기"
  ];

  if (ignoredExact.includes(text)) return true;

  return (
    /원문 내용 중 단어를 클릭하면/.test(text) ||
    /글자 확대.*글자 축소.*인쇄/.test(text) ||
    /원문 숨기기.*원문 보이기/.test(text) ||
    /해석 숨기기.*해석 보이기/.test(text) ||
    /All rights reserved/i.test(text) ||
    /www\.littlefox\.co\.kr/i.test(text) ||
    /©\s*2000-2026/i.test(text)
  );
}

/* =========================================
   제목 추출
   새 형식: 제목: My Helicopter
   기존 형식도 지원
========================================= */

function extractTitle(line) {
  const newMatch = line.match(/^제목:\s*(.+)$/);

  if (newMatch) {
    return newMatch[1].trim();
  }

  const oldMatch = line.match(
    /^My First Readers\s*2\s*,\s*(.+)$/i
  );

  return oldMatch ? oldMatch[1].trim() : null;
}

/* =========================================
   동화 TXT 파싱
   예시:
   1
   제목: My Helicopter
   (나의 헬리콥터)
   I can fly over the field.
   나는 들판 위로 날아갈 수 있어요.
   2
   제목: ...
========================================= */

function parseStories(rawText) {
  const lines = rawText
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .map((line) => line.replace(/^\[L\d+\]\s*/, "").trim());

  const parsed = new Map();

  let storyNumber = null;
  let titleFound = false;
  let koreanTitlePending = false;

  function createStory(number) {
    return {
      id: number,
      title: `동화 ${number}`,
      lines: []
    };
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 독립된 숫자 1~67은 동화 시작 표시
    if (/^\d{1,2}$/.test(line)) {
      const number = Number(line);

      if (number >= 1 && number <= TOTAL_STORIES) {
        storyNumber = number;

        if (!parsed.has(number)) {
          parsed.set(number, createStory(number));
        }

        titleFound = false;
        koreanTitlePending = false;
        continue;
      }
    }

    if (!storyNumber || !line) continue;

    const story = parsed.get(storyNumber);

    // 제목: 영어 제목 형식 인식
    const title = extractTitle(line);

    if (title) {
      story.title = title;
      titleFound = true;
      koreanTitlePending = true;
      continue;
    }

    // 제목을 찾기 전의 안내 문구 무시
    if (!titleFound) continue;

    // 영어 제목 바로 뒤의 한글 제목 제거
    // 예: (나의 헬리콥터) 또는 나의 헬리콥터
    if (koreanTitlePending) {
      if (
        /^[（(]?\s*[가-힣].*[）)]?$/.test(line) ||
        /^[가-힣].*$/.test(line)
      ) {
        koreanTitlePending = false;
        continue;
      }

      if (isPageInstruction(line)) continue;

      koreanTitlePending = false;
    }

    // 웹페이지 안내 및 저작권 문구 제거
    if (isPageInstruction(line)) continue;

    // 페이지 번호만 있는 줄 제거
    if (/^\d+$/.test(line)) continue;

    const language = detectLanguage(line);

    if (language === "en" || language === "ko") {
      story.lines.push({
        text: line,
        lang: language
      });
    }
  }

  const result = [];

  for (let i = 1; i <= TOTAL_STORIES; i++) {
    result.push(parsed.get(i) || createStory(i));
  }

  return result;
}

/* =========================================
   동화 범위
========================================= */

function getRangeBounds(range) {
  const ranges = {
    "1-20": [1, 20],
    "21-40": [21, 40],
    "41-60": [41, 60],
    "61-67": [61, 67]
  };

  return ranges[range] || ranges["1-20"];
}

function getStoriesInRange(range = currentRange) {
  const [start, end] = getRangeBounds(range);

  return stories.filter(
    (story) => story.id >= start && story.id <= end
  );
}

/* =========================================
   동화 목록 출력
========================================= */

function renderStoryList() {
  const container =
    $("storyList") ||
    $("storyGrid") ||
    $("storiesList");

  if (!container) return;

  container.innerHTML = "";

  getStoriesInRange().forEach((story) => {
    const item = document.createElement("button");

    item.type = "button";
    item.className = "story-item";

    if (completedStories.has(story.id)) {
      item.classList.add("completed");
    }

    item.setAttribute(
      "aria-label",
      `${story.id}번 ${story.title}` +
      (completedStories.has(story.id) ? ", 학습 완료" : "")
    );

    const check = completedStories.has(story.id) ? "✓" : "";

    item.innerHTML = `
      <span class="story-number">${story.id}</span>
      <span class="story-title"></span>
      <span class="story-check">${check}</span>
    `;

    const titleEl = item.querySelector(".story-title");

    if (titleEl) {
      titleEl.textContent = story.title;
    }

    item.addEventListener("click", () => {
      openStory(story.id);
    });

    container.appendChild(item);
  });

  updateProgress();
}

/* =========================================
   범위 버튼
========================================= */

function selectRange(range) {
  currentRange = range;

  document.querySelectorAll("[data-range]").forEach((button) => {
    const selected = button.dataset.range === range;

    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
  });

  renderStoryList();
}

/* =========================================
   동화 학습 화면
========================================= */

function openStory(number) {
  const story = stories.find(
    (item) => item.id === Number(number)
  );

  if (!story) {
    alert(`${number}번 동화를 찾을 수 없습니다.`);
    return;
  }

  currentStory = story.id;

  stopAudio();
  renderStudy();
  showView("studyView");
  updateAudioTitle();
  updateNavigationButtons();
}

/* =========================================
   영어 / 한국어 / 함께 보기
========================================= */

function setMode(mode) {
  if (!["both", "en", "ko"].includes(mode)) {
    mode = "both";
  }

  currentMode = mode;

  document.querySelectorAll("[data-mode]").forEach((button) => {
    const selected = button.dataset.mode === mode;

    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
  });

  renderStudy();
}

/* =========================================
   본문 출력
========================================= */

function renderStudy() {
  const story = stories.find(
    (item) => item.id === currentStory
  );

  if (!story) return;

  const titleElement =
    $("studyTitle") ||
    $("storyTitle") ||
    $("currentStoryTitle");

  if (titleElement) {
    titleElement.textContent = `${story.id}. ${story.title}`;
  }

  const body =
    $("storyContent") ||
    $("studyContent") ||
    $("storyBody");

  if (!body) return;

  body.innerHTML = "";

  const filteredLines = story.lines.filter((line) => {
    if (currentMode === "en") return line.lang === "en";
    if (currentMode === "ko") return line.lang === "ko";
    return line.lang === "en" || line.lang === "ko";
  });

  if (filteredLines.length === 0) {
    const message = document.createElement("p");
    message.className = "empty-story";
    message.textContent =
      "본문이 없습니다. data/story67.txt 파일의 형식을 확인해 주세요.";

    body.appendChild(message);
    return;
  }

  filteredLines.forEach((line) => {
    const paragraph = document.createElement("p");

    paragraph.className =
      line.lang === "en"
        ? "story-line english-line"
        : "story-line korean-line";

    paragraph.textContent = line.text;
    body.appendChild(paragraph);
  });

  updateCompleteButton();
}

/* =========================================
   이전 / 목록 / 다음
========================================= */

function goPrevious() {
  if (currentStory > 1) {
    openStory(currentStory - 1);
  }
}

function goNext() {
  if (currentStory < TOTAL_STORIES) {
    openStory(currentStory + 1);
  }
}

function goToList() {
  stopAudio();

  const [start, end] = getRangeBounds(currentRange);

  if (currentStory < start || currentStory > end) {
    if (currentStory <= 20) {
      selectRange("1-20");
    } else if (currentStory <= 40) {
      selectRange("21-40");
    } else if (currentStory <= 60) {
      selectRange("41-60");
    } else {
      selectRange("61-67");
    }
  }

  renderStoryList();
  showView("listView");
}

function updateNavigationButtons() {
  const previousButton =
    $("prevButton") || $("previousButton");

  const nextButton = $("nextButton");

  if (previousButton) {
    previousButton.disabled = currentStory <= 1;
  }

  if (nextButton) {
    nextButton.disabled = currentStory >= TOTAL_STORIES;
  }
}

/* =========================================
   학습 완료 체크
========================================= */

function toggleComplete() {
  if (completedStories.has(currentStory)) {
    completedStories.delete(currentStory);
  } else {
    completedStories.add(currentStory);
  }

  saveCompletedStories();
  updateCompleteButton();
  updateProgress();
  renderStoryList();
}

function updateCompleteButton() {
  const button =
    $("completeButton") ||
    $("markCompleteButton");

  if (!button) return;

  const completed = completedStories.has(currentStory);

  button.textContent = completed
    ? "✓ 학습 완료 취소"
    : "✓ 학습 완료 체크 저장";

  button.classList.toggle("completed", completed);
  button.setAttribute("aria-pressed", completed ? "true" : "false");
}

function updateProgress() {
  const count = completedStories.size;
  const percent = Math.round((count / TOTAL_STORIES) * 100);

  const countElement =
    $("progressCount") ||
    $("completedCount");

  const percentElement = $("progressPercent");
  const bar = $("progressBar");

  if (countElement) {
    countElement.textContent = `${count} / ${TOTAL_STORIES}`;
  }

  if (percentElement) {
    percentElement.textContent = `${percent}%`;
  }

  if (bar) {
    bar.style.width = `${percent}%`;
    bar.setAttribute("aria-valuenow", String(percent));
  }
}

/* =========================================
   오디오
   파일 예시: ./s67/s01.mp3
========================================= */

function getAudioPath(number) {
  return `${AUDIO_DIR}s${String(number).padStart(2, "0")}.mp3`;
}

function updateAudioTitle() {
  const story = stories.find(
    (item) => item.id === currentStory
  );

  const title =
    $("audioTitle") ||
    $("playerTitle");

  if (title && story) {
    title.textContent = `${story.id}. ${story.title}`;
  }
}

function loadAudio(number) {
  const path = getAudioPath(number);

  audio.pause();
  audio.currentTime = 0;
  audio.src = path;
  audio.load();

  audioReady = true;
  updateAudioTitle();
}

function playAudio() {
  if (!audioReady || !audio.src) {
    loadAudio(currentStory);
  }

  audio.playbackRate = getSelectedSpeed();

  audio.play().catch((error) => {
    console.error("오디오 재생 오류:", error);

    alert(
      "오디오를 재생할 수 없습니다.\n" +
      `파일 위치를 확인해 주세요: ${getAudioPath(currentStory)}`
    );
  });
}

function pauseAudio() {
  audio.pause();
}

function toggleAudio() {
  if (audio.paused) {
    playAudio();
  } else {
    pauseAudio();
  }
}

function stopAudio() {
  audio.pause();

  try {
    audio.currentTime = 0;
  } catch (error) {
    // 오디오가 아직 준비되지 않은 경우 무시
  }
}

function getSelectedSpeed() {
  const speedSelect =
    $("speedSelect") ||
    $("playbackSpeed");

  const speed = speedSelect ? Number(speedSelect.value) : 1;

  return Number.isFinite(speed) && speed > 0 ? speed : 1;
}

function setAudioSpeed(speed) {
  const value = Number(speed);

  if (!Number.isFinite(value) || value <= 0) return;

  audio.playbackRate = value;
}

/* =========================================
   오디오 진행 표시
========================================= */

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function updateAudioProgress() {
  const currentTimeElement = $("currentTime");
  const durationElement = $("durationTime");

  const progress =
    $("audioProgress") ||
    $("progressSeek");

  if (currentTimeElement) {
    currentTimeElement.textContent = formatTime(audio.currentTime);
  }

  if (durationElement) {
    durationElement.textContent = formatTime(audio.duration);
  }

  if (
    progress &&
    Number.isFinite(audio.duration) &&
    audio.duration > 0
  ) {
    progress.max = String(audio.duration);
    progress.value = String(audio.currentTime);
  }

  const playButton =
    $("playButton") ||
    $("audioPlayButton");

  if (playButton) {
    playButton.textContent = audio.paused
      ? "▶ 재생"
      : "Ⅱ 일시정지";
  }
}

function seekAudio(value) {
  const time = Number(value);

  if (
    Number.isFinite(time) &&
    Number.isFinite(audio.duration)
  ) {
    audio.currentTime = Math.max(
      0,
      Math.min(time, audio.duration)
    );
  }
}

/* =========================================
   버튼 이벤트 연결
========================================= */

function bindClick(ids, callback) {
  ids.forEach((id) => {
    const element = $(id);

    if (element) {
      element.addEventListener("click", callback);
    }
  });
}

function bindEvents() {
  bindClick(
    ["startButton", "goListButton", "openListButton"],
    () => {
      renderStoryList();
      showView("listView");
    }
  );

  bindClick(
    ["homeButton", "backHomeButton"],
    () => {
      stopAudio();
      showView("homeView");
    }
  );

  bindClick(
    ["listButton", "backToListButton"],
    goToList
  );

  bindClick(
    ["prevButton", "previousButton"],
    goPrevious
  );

  bindClick(["nextButton"], goNext);

  bindClick(
    ["completeButton", "markCompleteButton"],
    toggleComplete
  );

  bindClick(
    ["playButton", "audioPlayButton"],
    toggleAudio
  );

  bindClick(["pauseButton"], pauseAudio);
  bindClick(["stopButton"], stopAudio);

  document.querySelectorAll("[data-range]").forEach((button) => {
    button.addEventListener("click", () => {
      selectRange(button.dataset.range);
    });
  });

  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      setMode(button.dataset.mode);
    });
  });

  const speedSelect =
    $("speedSelect") ||
    $("playbackSpeed");

  if (speedSelect) {
    speedSelect.addEventListener("change", () => {
      setAudioSpeed(speedSelect.value);
    });
  }

  const progress =
    $("audioProgress") ||
    $("progressSeek");

  if (progress) {
    progress.addEventListener("input", () => {
      seekAudio(progress.value);
    });
  }

  audio.addEventListener("timeupdate", updateAudioProgress);
  audio.addEventListener("loadedmetadata", updateAudioProgress);
  audio.addEventListener("play", updateAudioProgress);
  audio.addEventListener("pause", updateAudioProgress);
  audio.addEventListener("ended", updateAudioProgress);

  audio.addEventListener("error", () => {
    console.error(
      "오디오 파일을 불러오지 못했습니다:",
      audio.src
    );
  });

  document.addEventListener("keydown", (event) => {
    const tag = event.target?.tagName;

    if (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT"
    ) {
      return;
    }

    if (
      $("studyView") &&
      $("studyView").style.display !== "none" &&
      !$("studyView").hidden
    ) {
      if (event.key === "ArrowLeft") {
        goPrevious();
      } else if (event.key === "ArrowRight") {
        goNext();
      }
    }
  });
}

/* =========================================
   초기 실행
========================================= */

async function initApp() {
  bindEvents();

  try {
    const rawText = await loadStoryText();

    stories = parseStories(rawText);

    const loadedCount = stories.filter(
      (story) => story.lines.length > 0
    ).length;

    console.log(
      `동화 ${loadedCount}/${TOTAL_STORIES}편의 본문을 읽었습니다.`
    );

    if (loadedCount === 0) {
      throw new Error(
        "동화 본문을 읽지 못했습니다. story67.txt의 형식을 확인해 주세요."
      );
    }

    renderStoryList();
    updateProgress();
    selectRange("1-20");
    showView("homeView");
  } catch (error) {
    console.error(error);

    const message =
      $("errorMessage") ||
      $("loadingMessage");

    if (message) {
      message.hidden = false;
      message.style.display = "block";
      message.textContent =
        "동화 데이터를 불러오지 못했습니다. " +
        "GitHub 저장소에서 data/story67.txt 파일의 위치와 이름을 확인해 주세요.";
    } else {
      alert(
        "동화 데이터를 불러오지 못했습니다.\n\n" +
        error.message
      );
    }
  }
}

document.addEventListener("DOMContentLoaded", initApp);
