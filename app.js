
const TOTAL_STORIES = 67;
const DATA_DIR = "./data/";
const AUDIO_DIR = "./s67/";

let stories = [];
let currentStory = 1;
let currentMode = "both";
let audio = new Audio();

const $ = (id) => document.getElementById(id);

/* TXT 파일 하나 읽기 */
async function loadOneStory(number) {
  const filename = `w${String(number).padStart(2, "0")}.txt`;
  const response = await fetch(DATA_DIR + filename, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`${filename} 파일을 불러오지 못했습니다.`);
  }

  const text = (await response.text()).replace(/^\uFEFF/, "");
  return parseOneStory(text, number);
}

/* 제목과 본문 분리 */
function parseOneStory(text, number) {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);

  let title = `동화 ${number}`;
  let skipKoreanTitle = false;
  const content = [];

  for (const line of lines) {
    const titleMatch = line.match(/^제목:\s*(.+)$/);

    if (titleMatch) {
      title = titleMatch[1].trim();
      skipKoreanTitle = true;
      continue;
    }

    // 제목 다음 줄의 한글 번역 제목 제외
    if (
      skipKoreanTitle &&
      (/^[（(].*[）)]$/.test(line) || /^[가-힣].*$/.test(line))
    ) {
      skipKoreanTitle = false;
      continue;
    }

    skipKoreanTitle = false;

    // 불필요한 안내 및 저작권 문구 제외
    if (
      /학습자료|원문해석|글자 확대|글자 축소|인쇄/.test(line) ||
      /원문 숨기기|원문 보이기/.test(line) ||
      /All rights reserved|www\.littlefox\.co\.kr|©\s*2000-2026/i.test(line)
    ) {
      continue;
    }

    if (/[a-zA-Z]/.test(line)) {
      content.push({ text: line, lang: "en" });
    } else if (/[가-힣]/.test(line)) {
      content.push({ text: line, lang: "ko" });
    }
  }

  return { id: number, title, lines: content };
}

/* 67편 모두 불러오기 */
async function loadAllStories() {
  const results = await Promise.all(
    Array.from({ length: TOTAL_STORIES }, (_, i) =>
      loadOneStory(i + 1)
    )
  );

  stories = results;
}

/* 동화 목록 표시 */
function renderStoryList() {
  const list =
    $("storyList") ||
    $("storyGrid") ||
    $("storiesList");

  if (!list) {
    console.error("동화 목록을 표시할 HTML 요소를 찾지 못했습니다.");
    return;
  }

  list.innerHTML = "";

  const ranges = {
    "1-20": [1, 20],
    "21-40": [21, 40],
    "41-60": [41, 60],
    "61-67": [61, 67]
  };

  const selectedRange = window.currentRange || "1-20";
  const [start, end] = ranges[selectedRange] || ranges["1-20"];

  stories
    .filter(story => story.id >= start && story.id <= end)
    .forEach(story => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "story-item";
      button.textContent = `${story.id}. ${story.title}`;
      button.addEventListener("click", () => openStory(story.id));
      list.appendChild(button);
    });
}

/* 동화 한 편 열기 */
function openStory(number) {
  const story = stories.find(item => item.id === number);
  if (!story) return;

  currentStory = number;

  const title =
    $("studyTitle") ||
    $("storyTitle") ||
    $("currentStoryTitle");

  if (title) {
    title.textContent = `${number}. ${story.title}`;
  }

  const body =
    $("storyContent") ||
    $("studyContent") ||
    $("storyBody");

  if (body) {
    body.innerHTML = "";

    story.lines
      .filter(line =>
        currentMode === "both" ||
        line.lang === currentMode
      )
      .forEach(line => {
        const p = document.createElement("p");
        p.className = line.lang === "en"
          ? "english-line"
          : "korean-line";
        p.textContent = line.text;
        body.appendChild(p);
      });
  }

  audio.pause();
  audio.currentTime = 0;
  audio.src = `${AUDIO_DIR}s${String(number).padStart(2, "0")}.mp3`;
  audio.load();

  const audioTitle = $("audioTitle") || $("playerTitle");
  if (audioTitle) audioTitle.textContent = story.title;

  const view = $("studyView");
  if (view) {
    view.hidden = false;
    view.style.display = "";
  }
}

/* 영어 / 한국어 / 함께 보기 */
function setMode(mode) {
  currentMode = mode;
  openStory(currentStory);
}

/* 오디오 재생 */
function playAudio() {
  audio.play().catch(error => {
    console.error("오디오 재생 오류:", error);
    alert("오디오 파일의 경로와 파일명을 확인해 주세요.");
  });
}

function pauseAudio() {
  audio.pause();
}

function stopAudio() {
  audio.pause();
  audio.currentTime = 0;
}

/* 초기 실행 */
async function initApp() {
  try {
    await loadAllStories();
    console.log(`동화 ${stories.length}/67편을 불러왔습니다.`);

    renderStoryList();

    const error = $("errorMessage");
    if (error) {
      error.hidden = true;
      error.style.display = "none";
    }
  } catch (error) {
    console.error("동화 데이터 로딩 오류:", error);

    const message =
      $("errorMessage") ||
      $("loadingMessage");

    if (message) {
      message.hidden = false;
      message.style.display = "block";
      message.textContent = error.message;
    } else {
      alert(error.message);
    }
  }
}

document.addEventListener("DOMContentLoaded", initApp);
