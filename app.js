
const TOTAL_STORIES = 67;
const DATA_DIR = "./data/";
const AUDIO_DIR = "./s67/";
const STORAGE_KEY = "littlefox_level2_completed";

const stories = [];
let currentStory = null;
let currentRange = { start: 1, end: 20 };
let currentMode = "both";
let audio = new Audio();

const $ = (id) => document.getElementById(id);

function padNumber(number) {
  return String(number).padStart(2, "0");
}

function getCompleted() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return new Set(saved.map(Number));
  } catch {
    return new Set();
  }
}

let completedStories = getCompleted();

function saveCompleted() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([...completedStories].sort((a, b) => a - b))
  );
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function parseStory(number, text) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let title = `동화 ${number}`;
  let koreanTitle = "";
  const contentLines = [];

  for (const line of lines) {
    if (/^제목\s*[:：]/.test(line)) {
      title = line.replace(/^제목\s*[:：]\s*/, "").trim();
      continue;
    }

    // 제목 다음에 있는 한국어 제목
    if (!koreanTitle && contentLines.length === 0) {
      const match = line.match(/^\((.+)\)$/);
      if (match) {
        koreanTitle = match[1].trim();
        continue;
      }
    }

    // 원본 자료의 제목 안내나 불필요한 출처 문구 제외
    if (/^My First Readers\b/i.test(line)) continue;
    if (/^리틀팍스/i.test(line)) continue;
    if (/^영어 문장\s*[,/·]\s*한국어 해석/.test(line)) continue;

    contentLines.push(line);
  }

  const pairs = [];
  let pendingEnglish = "";

  for (const line of contentLines) {
    const isKorean = /[가-힣]/.test(line);

    if (!isKorean) {
      if (pendingEnglish) {
        pairs.push({ english: pendingEnglish, korean: "" });
      }
      pendingEnglish = line;
    } else {
      if (pendingEnglish) {
        pairs.push({ english: pendingEnglish, korean: line });
        pendingEnglish = "";
      } else if (pairs.length > 0 && !pairs[pairs.length - 1].korean) {
        pairs[pairs.length - 1].korean = line;
      } else {
        pairs.push({ english: "", korean: line });
      }
    }
  }

  if (pendingEnglish) {
    pairs.push({ english: pendingEnglish, korean: "" });
  }

  return {
    number,
    title,
    koreanTitle,
    pairs,
    loaded: true
  };
}

async function loadOneStory(number) {
  try {
    const response = await fetch(`${DATA_DIR}w${padNumber(number)}.txt`);

    if (!response.ok) {
      throw new Error(`파일을 찾을 수 없습니다: w${padNumber(number)}.txt`);
    }

    const text = await response.text();
    return parseStory(number, text);
  } catch (error) {
    console.error(error);
    return {
      number,
      title: `동화 ${number}`,
      koreanTitle: "",
      pairs: [],
      loaded: false
    };
  }
}

async function loadAllStories() {
  const results = await Promise.all(
    Array.from({ length: TOTAL_STORIES }, (_, i) => loadOneStory(i + 1))
  );

  stories.splice(0, stories.length, ...results);
  updateProgress();
}

function getStoryTitle(story) {
  if (!story) return "";
  return story.koreanTitle
    ? `${story.title} (${story.koreanTitle})`
    : story.title;
}

function updateProgress() {
  const count = completedStories.size;
  const percent = Math.round((count / TOTAL_STORIES) * 100);

  $("progressCount").textContent = `${count} / ${TOTAL_STORIES}`;
  $("progressBar").style.width = `${percent}%`;
  $("progressText").textContent =
    count === TOTAL_STORIES
      ? "🎉 대단해요! 67편을 모두 학습했어요!"
      : `${percent}% 완료! 조금씩 꾸준히 해 봐요 🌱`;

  $("progressTrack").setAttribute("aria-valuenow", String(count));
}

function showView(viewName) {
  for (const id of ["homeView", "listView", "studyView"]) {
    const view = $(id);
    const isActive = id === viewName;

    view.classList.toggle("active", isActive);
    view.hidden = !isActive;
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function selectRange(range) {
  const [start, end] = range.split("-").map(Number);
  currentRange = { start, end };

  $("listTitle").textContent = `📚 ${start}~${end}번 동화`;
  renderStoryList();
  showView("listView");
}

function renderStoryList() {
  const list = $("storyList");
  list.replaceChildren();

  for (let number = currentRange.start; number <= currentRange.end; number++) {
    const story = stories[number - 1];
    const isCompleted = completedStories.has(number);

    const item = document.createElement("div");
    item.className = `story-item${isCompleted ? " completed" : ""}`;

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "story-open";
    openButton.setAttribute("aria-label", `${number}번 ${getStoryTitle(story)} 학습하기`);

    const numberBadge = document.createElement("span");
    numberBadge.className = "story-number";
    numberBadge.textContent = number;

    const titleWrap = document.createElement("span");
    titleWrap.className = "story-title-wrap";

    const title = document.createElement("span");
    title.className = "story-title";
    title.textContent = getStoryTitle(story);

    const subtitle = document.createElement("span");
    subtitle.className = "story-subtitle";
    subtitle.textContent = story && story.loaded ? "📖 눌러서 학습하기" : "⚠️ 동화 파일 확인 필요";

    titleWrap.append(title, subtitle);
    openButton.append(numberBadge, titleWrap);
    openButton.addEventListener("click", () => openStory(number));

    const status = document.createElement("span");
    status.className = `story-status${isCompleted ? " done" : ""}`;
    status.textContent = isCompleted ? "☑ 학습 완료" : "○ 학습 전";
    status.setAttribute("aria-label", isCompleted ? "학습 완료" : "학습 전");

    item.append(openButton, status);
    list.append(item);
  }
}

function openStory(number) {
  currentStory = stories[number - 1];

  if (!currentStory) return;

  currentMode = "both";
  updateModeButtons();
  renderStudyStory();
  updateCompleteButton();
  updateNavigation();

  stopAudio();
  showView("studyView");
}

function renderStudyStory() {
  const story = currentStory;

  $("studyTitle").textContent = `📖 ${story.number}. ${getStoryTitle(story)}`;

  const content = $("storyContent");
  content.replaceChildren();

  if (!story.loaded || story.pairs.length === 0) {
    const message = document.createElement("p");
    message.textContent = "동화 내용을 불러오지 못했어요. data 폴더의 TXT 파일을 확인해 주세요.";
    content.append(message);
    return;
  }

  for (const pair of story.pairs) {
    if (currentMode !== "korean" && pair.english) {
      const english = document.createElement("p");
      english.className = "english-line";
      english.textContent = pair.english;
      content.append(english);
    }

    if (currentMode !== "english" && pair.korean) {
      const korean = document.createElement("p");
      korean.className = "korean-line";
      korean.textContent = pair.korean;
      content.append(korean);
    }
  }
}

function updateModeButtons() {
  document.querySelectorAll(".mode-buttons button").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === currentMode);
  });
}

function setMode(mode) {
  currentMode = mode;
  updateModeButtons();

  if (currentStory) {
    renderStudyStory();
  }
}

function updateCompleteButton() {
  if (!currentStory) return;

  const isCompleted = completedStories.has(currentStory.number);
  const button = $("completeButton");

  button.classList.toggle("completed", isCompleted);
  button.textContent = isCompleted ? "☑ 학습 완료 취소" : "○ 학습 완료 체크";
}

function toggleComplete() {
  if (!currentStory) return;

  const number = currentStory.number;

  if (completedStories.has(number)) {
    completedStories.delete(number);
  } else {
    completedStories.add(number);
  }

  saveCompleted();
  updateProgress();
  updateCompleteButton();
  renderStoryList();
}

function updateNavigation() {
  if (!currentStory) return;

  $("prevButton").disabled = currentStory.number <= 1;
  $("nextButton").disabled = currentStory.number >= TOTAL_STORIES;
}

function moveStory(step) {
  if (!currentStory) return;

  const nextNumber = currentStory.number + step;

  if (nextNumber < 1 || nextNumber > TOTAL_STORIES) return;

  openStory(nextNumber);
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function updateAudioProgress() {
  const duration = audio.duration || 0;
  const current = audio.currentTime || 0;

  $("currentTime").textContent = formatTime(current);
  $("durationTime").textContent = formatTime(duration);
  $("audioProgress").value = duration ? (current / duration) * 100 : 0;
}

function playAudio() {
  if (!currentStory) return;

  const expectedSource = new URL(
    `${AUDIO_DIR}s${padNumber(currentStory.number)}.mp3`,
    window.location.href
  ).href;

  if (audio.src !== expectedSource) {
    audio.src = expectedSource;
    audio.load();
  }

  audio.playbackRate = Number($("speedSelect").value);

  audio.play().catch((error) => {
    console.error("오디오 재생 오류:", error);
    alert("오디오를 재생할 수 없어요. s67 폴더의 MP3 파일 이름을 확인해 주세요.");
  });
}

function stopAudio() {
  audio.pause();
  audio.currentTime = 0;
  updateAudioProgress();
}

function bindEvents() {
  document.querySelectorAll("[data-range]").forEach((button) => {
    button.addEventListener("click", () => selectRange(button.dataset.range));
  });

  $("homeButton").addEventListener("click", () => showView("homeView"));

  $("backToListButton").addEventListener("click", () => {
    stopAudio();
    renderStoryList();
    showView("listView");
  });

  $("showBothButton").addEventListener("click", () => setMode("both"));
  $("showEnglishButton").addEventListener("click", () => setMode("english"));
  $("showKoreanButton").addEventListener("click", () => setMode("korean"));

  $("completeButton").addEventListener("click", toggleComplete);
  $("prevButton").addEventListener("click", () => moveStory(-1));
  $("nextButton").addEventListener("click", () => moveStory(1));

  $("playButton").addEventListener("click", playAudio);
  $("stopButton").addEventListener("click", stopAudio);

  $("speedSelect").addEventListener("change", () => {
    audio.playbackRate = Number($("speedSelect").value);
  });

  $("audioProgress").addEventListener("input", () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime = (Number($("audioProgress").value) / 100) * audio.duration;
    }
  });

  audio.addEventListener("timeupdate", updateAudioProgress);
  audio.addEventListener("loadedmetadata", updateAudioProgress);
  audio.addEventListener("durationchange", updateAudioProgress);
  audio.addEventListener("ended", updateAudioProgress);
  audio.addEventListener("error", () => {
    console.error("MP3 파일을 불러오지 못했습니다:", audio.src);
  });
}

async function initApp() {
  bindEvents();
  updateProgress();
  showView("homeView");
  await loadAllStories();
}

initApp();
