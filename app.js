
const TOTAL_STORIES = 67;
const DATA_DIR = "./data/";
const AUDIO_DIR = "./s67/";
const STORAGE_KEY = "littlefox_level2_completed";

const stories = [];
let currentStory = null;
let currentRange = { start: 1, end: 20 };
let currentMode = "both";
let playbackSpeed = 1;

const audio = new Audio();
const $ = id => document.getElementById(id);
const padNumber = number => String(number).padStart(2, "0");

function getCompleted() {
  try {
    return new Set(
      JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]").map(Number)
    );
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

function parseStory(number, text) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  let title = `동화 ${number}`;
  let koreanTitle = "";
  const contentLines = [];

  for (const line of lines) {
    if (/^제목\s*[:：]/.test(line)) {
      title = line.replace(/^제목\s*[:：]\s*/, "").trim();
      continue;
    }

    if (!koreanTitle && contentLines.length === 0) {
      const match = line.match(/^\((.+)\)$/);
      if (match) {
        koreanTitle = match[1].trim();
        continue;
      }
    }

    if (/^My First Readers\b/i.test(line)) continue;
    if (/^리틀팍스/i.test(line)) continue;

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
    } else if (pendingEnglish) {
      pairs.push({ english: pendingEnglish, korean: line });
      pendingEnglish = "";
    } else if (pairs.length && !pairs[pairs.length - 1].korean) {
      pairs[pairs.length - 1].korean = line;
    } else {
      pairs.push({ english: "", korean: line });
    }
  }

  if (pendingEnglish) {
    pairs.push({ english: pendingEnglish, korean: "" });
  }

  return { number, title, koreanTitle, pairs, loaded: true };
}

async function loadOneStory(number) {
  try {
    const response = await fetch(`${DATA_DIR}w${padNumber(number)}.txt`);

    if (!response.ok) {
      throw new Error(`w${padNumber(number)}.txt 파일을 불러오지 못했습니다.`);
    }

    return parseStory(number, await response.text());
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
  const loaded = await Promise.all(
    Array.from({ length: TOTAL_STORIES }, (_, index) =>
      loadOneStory(index + 1)
    )
  );

  stories.splice(0, stories.length, ...loaded);
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
  const percent = Math.round(count / TOTAL_STORIES * 100);

  $("progressCount").textContent = `${count} / ${TOTAL_STORIES}`;
  $("progressBar").style.width = `${percent}%`;
  $("progressText").textContent = count === TOTAL_STORIES
    ? "🎉 대단해요! 67편을 모두 학습했어요!"
    : `${percent}% 완료! 조금씩 꾸준히 해 봐요 🌱`;

  $("progressTrack").setAttribute("aria-valuenow", String(count));
}

function showView(viewName) {
  ["homeView", "listView", "studyView"].forEach(id => {
    const view = $(id);
    const active = id === viewName;

    view.classList.toggle("active", active);
    view.hidden = !active;
  });

  $("fixedPlayer").hidden = viewName !== "studyView";
  window.scrollTo({ top: 0, behavior: "instant" });
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
    const done = completedStories.has(number);

    const item = document.createElement("div");
    item.className = `story-item${done ? " completed" : ""}`;

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "story-open";

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
    subtitle.textContent = story?.loaded
      ? "📖 눌러서 학습하기"
      : "⚠️ 파일을 확인해 주세요";

    titleWrap.append(title, subtitle);
    openButton.append(numberBadge, titleWrap);
    openButton.addEventListener("click", () => openStory(number));

    const status = document.createElement("span");
    status.className = `story-status${done ? " done" : ""}`;
    status.textContent = done ? "☑ 학습 완료" : "○ 학습 전";

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

  audio.src = new URL(
    `${AUDIO_DIR}s${padNumber(number)}.mp3`,
    window.location.href
  ).href;

  audio.load();
  updateSpeedDisplay();
  updatePlaybackButtons();
  showView("studyView");
}

function renderStudyStory() {
  if (!currentStory) return;

  $("studyTitle").textContent =
    `📖 ${currentStory.number}. ${getStoryTitle(currentStory)}`;

  const content = $("storyContent");
  content.replaceChildren();

  if (!currentStory.loaded || !currentStory.pairs.length) {
    const message = document.createElement("p");
    message.textContent =
      "동화 내용을 불러오지 못했어요. data 폴더의 TXT 파일을 확인해 주세요.";
    content.append(message);
    return;
  }

  for (const pair of currentStory.pairs) {
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

  content.scrollTop = 0;
}

function setMode(mode) {
  currentMode = mode;
  updateModeButtons();
  renderStudyStory();
}

function updateModeButtons() {
  document.querySelectorAll(".mode-buttons button").forEach(button => {
    button.classList.toggle("active", button.dataset.mode === currentMode);
  });
}

function updateCompleteButton() {
  if (!currentStory) return;

  const done = completedStories.has(currentStory.number);
  const button = $("completeButton");

  button.classList.toggle("completed", done);
  button.textContent = done ? "☑ 학습 완료 취소" : "○ 학습 완료 체크";
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
}

function updateNavigation() {
  $("prevButton").disabled = currentStory.number <= 1;
  $("nextButton").disabled = currentStory.number >= TOTAL_STORIES;
}

function moveStory(step) {
  if (!currentStory) return;

  const number = currentStory.number + step;
  if (number < 1 || number > TOTAL_STORIES) return;

  openStory(number);
}

/* 배속: 0.5~3배, 0.5씩 조절 */
function updateSpeedDisplay() {
  $("speedValue").textContent = `${playbackSpeed.toFixed(1)}배속`;
  audio.playbackRate = playbackSpeed;

  $("slowerButton").disabled = playbackSpeed <= 0.5;
  $("fasterButton").disabled = playbackSpeed >= 3;
}

function changeSpeed(direction) {
  playbackSpeed = Math.max(
    0.5,
    Math.min(3, Math.round((playbackSpeed + direction * 0.5) * 10) / 10)
  );

  updateSpeedDisplay();
}

function updatePlaybackButtons() {
  $("playButton").disabled = !audio.paused && !audio.ended;
  $("pauseButton").disabled = audio.paused || audio.ended;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function updateAudioProgress() {
  const duration = audio.duration || 0;

  $("currentTime").textContent = formatTime(audio.currentTime || 0);
  $("durationTime").textContent = formatTime(duration);
  $("audioProgress").value = duration
    ? (audio.currentTime / duration) * 100
    : 0;
}

async function playAudio() {
  if (!currentStory) return;

  if (audio.ended) {
    audio.currentTime = 0;
  }

  audio.playbackRate = playbackSpeed;

  try {
    await audio.play();
    updatePlaybackButtons();
  } catch (error) {
    console.error("오디오 재생 오류:", error);
    alert("오디오를 재생할 수 없어요. MP3 파일 경로와 이름을 확인해 주세요.");
  }
}

function pauseAudio() {
  audio.pause();
  updatePlaybackButtons();
}

function stopAudio() {
  audio.pause();
  audio.currentTime = 0;
  updateAudioProgress();
  updatePlaybackButtons();
}

function bindEvents() {
  document.querySelectorAll("[data-range]").forEach(button => {
    button.addEventListener("click", () => selectRange(button.dataset.range));
  });

  $("homeButton").addEventListener("click", () => {
    stopAudio();
    showView("homeView");
  });

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
  $("pauseButton").addEventListener("click", pauseAudio);
  $("stopButton").addEventListener("click", stopAudio);

  $("slowerButton").addEventListener("click", () => changeSpeed(-1));
  $("fasterButton").addEventListener("click", () => changeSpeed(1));

  $("audioProgress").addEventListener("input", () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime =
        (Number($("audioProgress").value) / 100) * audio.duration;
    }
  });

  audio.addEventListener("play", updatePlaybackButtons);
  audio.addEventListener("pause", updatePlaybackButtons);
  audio.addEventListener("ended", updatePlaybackButtons);
  audio.addEventListener("timeupdate", updateAudioProgress);
  audio.addEventListener("loadedmetadata", updateAudioProgress);
  audio.addEventListener("durationchange", updateAudioProgress);

  audio.addEventListener("error", () => {
    console.error("MP3 파일을 불러오지 못했습니다:", audio.src);
  });
}

async function initApp() {
  bindEvents();
  updateProgress();
  updateSpeedDisplay();
  updatePlaybackButtons();
  showView("homeView");
  await loadAllStories();
}

initApp();
