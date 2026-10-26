
/* =========================================
   리틀팍스 동화 레벨 2
   TXT 파일: data/w01.txt ~ data/w67.txt
   오디오: s67/s01.mp3 ~ s67/s67.mp3
========================================= */

const TOTAL_STORIES = 67;
const DATA_DIR = "./data/";
const AUDIO_DIR = "./s67/";
const STORAGE_KEY = "littlefox_level2_completed";

let stories = [];
let currentStory = 1;
let currentRange = "1-20";
let currentMode = "both";

const audio = new Audio();
const $ = (id) => document.getElementById(id);

const completed = new Set(
  JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")
);

const ranges = {
  "1-20": [1, 20],
  "21-40": [21, 40],
  "41-60": [41, 60],
  "61-67": [61, 67]
};

/* 화면 전환 */
function showView(viewId) {
  ["homeView", "listView", "studyView"].forEach(id => {
    const element = $(id);
    if (element) element.hidden = id !== viewId;
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* TXT 파일 읽기 */
async function loadOneStory(number) {
  const filename = `w${String(number).padStart(2, "0")}.txt`;
  const response = await fetch(DATA_DIR + filename, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(
      `${filename} 파일을 읽지 못했습니다.\n` +
      `GitHub의 data 폴더에 해당 파일이 있는지 확인해 주세요.`
    );
  }

  const text = (await response.text()).replace(/^\uFEFF/, "");
  return parseStory(text, number);
}

/* TXT 내용 분석 */
function parseStory(text, number) {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);

  let title = `동화 ${number}`;
  let koreanTitle = "";
  let foundTitle = false;
  let afterTitle = false;
  const content = [];

  for (const line of lines) {
    const match = line.match(/^제목:\s*(.+)$/);

    if (match) {
      title = match[1].trim();
      foundTitle = true;
      afterTitle = true;
      continue;
    }

    if (
      /^(학습자료|원문해석|글자 확대|글자 축소|인쇄)$/.test(line) ||
      /원문 내용 중 단어를 클릭하면/.test(line) ||
      /원문 숨기기|원문 보이기/.test(line) ||
      /All rights reserved|www\.littlefox\.co\.kr|©\s*2000-2026/i.test(line)
    ) {
      continue;
    }

    // 제목 바로 다음의 괄호 안 한글 제목
    if (afterTitle && /^[（(].*[）)]$/.test(line)) {
      koreanTitle = line.replace(/^[（(]/, "(").replace(/[）)]$/, ")");
      afterTitle = false;
      continue;
    }

    if (afterTitle) {
      afterTitle = false;

      // 괄호 없이 적힌 한글 제목도 처리
      if (/^[가-힣\s]+$/.test(line) && !/[.!?]/.test(line)) {
        koreanTitle = `(${line})`;
        continue;
      }
    }

    // 제목이 없는 파일의 첫 줄은 제목으로 처리하지 않고 본문으로 보존
    if (!line) continue;

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
    lines: content,
    hasTitle: foundTitle
  };
}

/* 67개 파일 불러오기 */
async function loadAllStories() {
  const loaded = await Promise.all(
    Array.from(
      { length: TOTAL_STORIES },
      (_, index) => loadOneStory(index + 1)
    )
  );

  stories = loaded;
}

/* 진행률 표시 */
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
      number.textContent = String(story.id);

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

/* 동화 열기 */
function openStory(number) {
  const story = stories.find(item => item.id === number);
  if (!story) return;

  currentStory = number;
  showView("studyView");

  const title = $("studyTitle");
  if (title) {
    title.textContent =
      `${story.id}. ${story.title}` +
      (story.koreanTitle ? ` ${story.koreanTitle}` : "");
  }

  renderStoryContent(story);
  updateStudyButtons();
  updateAudioTitle(story);

  audio.pause();
  audio.currentTime = 0;
  audio.src = `${AUDIO_DIR}s${String(number).padStart(2, "0")}.mp3`;
  audio.playbackRate = Number($("speedSelect")?.value || 1);
  audio.load();

  updateAudioProgress();
  updateCompleteButton();
}

/* 영어와 한국어 본문 표시 */
function renderStoryContent(story) {
  const body = $("storyContent");
  if (!body) return;

  body.innerHTML = "";

  const visibleLines = story.lines.filter(line => {
    if (currentMode === "both") return true;
    return line.lang === currentMode;
  });

  visibleLines.forEach(line => {
    const p = document.createElement("p");
    p.className = `story-line ${line.lang === "en" ? "english-line" : "korean-line"}`;
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

function updateAudioTitle(story) {
  const element = $("audioTitle");
  if (element) {
    element.textContent = `${story.id}. ${story.title}`;
  }
}

/* 이전 / 다음 버튼 상태 */
function updateStudyButtons() {
  if ($("prevButton")) {
    $("prevButton").disabled = currentStory <= 1;
  }

  if ($("nextButton")) {
    $("nextButton").disabled = currentStory >= TOTAL_STORIES;
  }
}

/* 학습 완료 저장 */
function updateCompleteButton() {
  const button = $("completeButton");
  if (!button) return;

  const isDone = completed.has(currentStory);
  button.textContent = isDone
    ? "✓ 학습 완료됨 (다시 누르면 해제)"
    : "✓ 학습 완료 체크 저장";

  button.classList.toggle("saved", isDone);
}

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

/* 오디오 재생 */
function playAudio() {
  if (!audio.src) {
    alert("먼저 동화를 선택해 주세요.");
    return;
  }

  audio.play().catch(error => {
    console.error("오디오 재생 오류:", error);
    alert(
      "오디오를 재생할 수 없습니다.\n" +
      "s67 폴더의 파일명이 s" +
      String(currentStory).padStart(2, "0") +
      ".mp3인지 확인해 주세요."
    );
  });
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

/* 오디오 위치 표시 */
function updateAudioProgress() {
  const current = $("currentTime");
  const duration = $("durationTime");
  const slider = $("audioProgress");

  if (current) {
    current.textContent = formatTime(audio.currentTime);
  }

  if (duration) {
    duration.textContent = formatTime(audio.duration);
  }

  if (slider) {
    slider.value = audio.duration
      ? (audio.currentTime / audio.duration) * 100
      : 0;
  }
}

/* 버튼 연결 */
function bindEvents() {
  $("startButton")?.addEventListener("click", () => {
    showView("listView");
    renderStoryList();
  });

  $("homeButton")?.addEventListener("click", () => {
    showView("homeView");
  });

  $("listButton")?.addEventListener("click", () => {
    audio.pause();
    showView("listView");
    renderStoryList();
  });

  document.querySelectorAll("[data-range]").forEach(button => {
    button.addEventListener("click", () => {
      currentRange = button.dataset.range;
      renderStoryList();
    });
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
        (Number(event.target.value) / 100) * audio.duration;
    }
  });

  audio.addEventListener("timeupdate", updateAudioProgress);
  audio.addEventListener("loadedmetadata", updateAudioProgress);
  audio.addEventListener("ended", updateAudioProgress);
}

/* 앱 시작 */
async function initApp() {
  bindEvents();
  updateProgress();

  try {
    await loadAllStories();

    console.log(`동화 ${stories.length}/${TOTAL_STORIES}편 로딩 완료`);

    const error = $("errorMessage");
    if (error) {
      error.hidden = true;
      error.textContent = "";
    }

    showView("homeView");
  } catch (error) {
    console.error(error);

    const message = $("errorMessage");
    if (message) {
      message.hidden = false;
      message.textContent = error.message;
    }
  }
}

document.addEventListener("DOMContentLoaded", initApp);
document.getElementById("startButton")?.addEventListener("click", () => {
  document.getElementById("homeView").hidden = true;
  document.getElementById("listView").hidden = false;
});
