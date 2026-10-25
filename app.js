
'use strict';

const TOTAL = 67;

// 기존에 음성이 잘 나오던 경로 유지
const AUDIO_DIR = './s67/';

const DATA_FILES = [
  './data/story67.txt',
  './데이터/story67.txt',
  './메모장w67.txt',
  './data/메모장w67.txt'
];

const $ = (selector) => document.querySelector(selector);

const home = $('#homeView');
const list = $('#listView');
const study = $('#studyView');
const audio = $('#audio');

const load = (key, fallback) => {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
};

const pad = (number) => String(number).padStart(2, '0');

const escapeHTML = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);

let stories = Array.from({ length: TOTAL }, (_, index) => ({
  id: index + 1,
  title: `${index + 1}번 동화`,
  lines: []
}));

let done = load('lf2_done', []);
let recent = load('lf2_recent', []);
let id = 1;
let start = 1;
let end = 20;
let mode = 'both';
let speed = 1;
let toastTimer = null;

// --------------------------------------------------
// 화면 표시
// --------------------------------------------------

function showView(view) {
  home.classList.toggle('hidden', view !== 'home');
  list.classList.toggle('hidden', view !== 'list');
  study.classList.toggle('hidden', view !== 'study');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('show');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    element.classList.remove('show');
  }, 2200);
}

function saveProgress() {
  localStorage.setItem('lf2_done', JSON.stringify(done));
  localStorage.setItem('lf2_recent', JSON.stringify(recent));
}

function addRecent(number) {
  recent = [
    number,
    ...recent.filter((item) => item !== number)
  ].slice(0, 6);

  localStorage.setItem('lf2_recent', JSON.stringify(recent));
}

// --------------------------------------------------
// 텍스트 불러오기
// 현재는 임시 파서이며 story67.txt 형식을 확인한 후
// 동화 경계를 정확히 나누도록 수정할 예정
// --------------------------------------------------

async function fetchStoryText() {
  for (const path of DATA_FILES) {
    try {
      const response = await fetch(path, { cache: 'no-cache' });

      if (response.ok) {
        const text = await response.text();

        if (text.trim()) {
          console.log('동화 파일 불러오기 성공:', path);
          return text.replace(/^\uFEFF/, '');
        }
      }
    } catch (error) {
      console.warn('파일 불러오기 실패:', path);
    }
  }

  throw new Error(
    'story67.txt 파일을 찾을 수 없습니다. 파일 경로와 이름을 확인해 주세요.'
  );
}

function parseStories(rawText) {
  const result = Array.from({ length: TOTAL }, (_, index) => ({
    id: index + 1,
    title: `${index + 1}번 동화`,
    lines: []
  }));

  /*
   * 임시 파서:
   * "1 | 제목", "1. 제목", "[1] 제목",
   * "1번 제목", "Story 1: 제목" 같은 표식을 인식합니다.
   *
   * 실제 파일에서 동화가 구분되는 방식을 확인한 뒤
   * 이 함수만 정확하게 조정할 예정입니다.
   */

  const lines = rawText.split(/\r?\n/);
  let current = null;
  let firstStoryHasContent = false;

  const headingPatterns = [
    /^\s*(\d{1,2})\s*\|\s*(.+?)\s*$/,
    /^\s*\[(\d{1,2})\]\s*(.*?)\s*$/,
    /^\s*(\d{1,2})\s*번(?:\s*[:：.)-]?\s*)(.*?)\s*$/,
    /^\s*Story\s*(\d{1,2})\s*[:：.)-]\s*(.*?)\s*$/i,
    /^\s*(\d{1,2})\s*[.)]\s+(.+?)\s*$/
  ];

  for (const originalLine of lines) {
    const line = originalLine.trim();

    if (!line) continue;

    let heading = null;

    for (const pattern of headingPatterns) {
      const match = line.match(pattern);

      if (match) {
        heading = {
          number: Number(match[1]),
          title: (match[2] || '').trim()
        };
        break;
      }
    }

    if (heading && heading.number >= 1 && heading.number <= TOTAL) {
      current = result[heading.number - 1];

      if (heading.title) {
        current.title = heading.title;
      }

      firstStoryHasContent = false;
      continue;
    }

    // 숫자만 있는 줄은 실제 파일 구조를 확인하기 전에는
    // 동화 구분자로 처리하지 않습니다.
    if (!current) {
      current = result[0];
    }

    // 웹페이지에서 복사된 불필요한 안내문 제거
    if (
      /^(학습자료|원문해석|글자 확대|글자 축소|인쇄)$/.test(line) ||
      /원문 숨기기|원문 보이기|단어를 클릭하면|글자 확대글자 축소인쇄/.test(line)
    ) {
      continue;
    }

    // 제목과 부제목으로 보이는 첫 두 줄은 임시 제목으로 활용
    if (!firstStoryHasContent && current.lines.length === 0) {
      if (
        line.length < 100 &&
        !/[.!?。]$/.test(line) &&
        !/^(나는|내가|그는|그녀는|이것은|저것은)\s/.test(line)
      ) {
        if (current.title.endsWith('번 동화')) {
          current.title = line;
          firstStoryHasContent = true;
          continue;
        }
      }
    }

    current.lines.push({
      text: line,
      lang: detectLanguage(line)
    });

    firstStoryHasContent = true;
  }

  return result;
}

function detectLanguage(text) {
  if (/[가-힣]/.test(text)) return 'ko';
  if (/[a-zA-Z]/.test(text)) return 'en';
  return 'other';
}

async function initializeStories() {
  try {
    const rawText = await fetchStoryText();
    stories = parseStories(rawText);
    renderHome();
    renderStudy();
  } catch (error) {
    console.error(error);
    $('#storyContent').innerHTML = `
      <p class="error-message">
        동화 텍스트 파일을 불러오지 못했습니다.<br>
        GitHub 저장소에서 파일 경로를 확인해 주세요.
      </p>
    `;
    renderHome();
  }
}

// --------------------------------------------------
// 홈 및 동화 목록
// --------------------------------------------------

function renderHome() {
  const completedCount = done.length;
  $('#progressText').textContent = `${completedCount} / ${TOTAL}`;
  $('#progressBar').style.width =
    `${Math.min(100, completedCount / TOTAL * 100)}%`;

  const grid = $('#storyGrid');
  grid.innerHTML = '';

  for (let number = start; number <= end; number++) {
    const button = document.createElement('button');
    button.className = 'story-card';
    button.innerHTML = `
      <span class="story-card-number">${number}</span>
      <span class="story-card-title">
        ${escapeHTML(stories[number - 1]?.title || `${number}번 동화`)}
      </span>
      <span class="story-card-status">
        ${done.includes(number) ? '✓ 완료' : '학습하기 ›'}
      </span>
    `;

    if (done.includes(number)) {
      button.classList.add('completed');
    }

    button.addEventListener('click', () => {
      openList(start, end);
      openStudy(number);
    });

    grid.appendChild(button);
  }

  const recentList = $('#recentList');

  if (recent.length === 0) {
    recentList.innerHTML = '<p class="empty-message">아직 학습 기록이 없어요.</p>';
  } else {
    recentList.innerHTML = '';

    recent.forEach((number) => {
      const button = document.createElement('button');
      button.className = 'recent-item';
      button.textContent =
        `${number}번 · ${stories[number - 1]?.title || '동화'}`;

      button.addEventListener('click', () => {
        start = number <= 20 ? 1 : number <= 40 ? 21 : number <= 60 ? 41 : 61;
        end = Math.min(start + 19, TOTAL);
        openStudy(number);
      });

      recentList.appendChild(button);
    });
  }
}

function openList(from, to) {
  start = from;
  end = to;

  $('#listTitle').textContent = `${from}~${to}번 동화 목록`;

  const container = $('#storyList');
  container.innerHTML = '';

  for (let number = from; number <= to; number++) {
    const button = document.createElement('button');
    button.className = 'story-list-item';

    button.innerHTML = `
      <span class="list-number">${number}</span>
      <span class="list-name">
        ${escapeHTML(stories[number - 1]?.title || `${number}번 동화`)}
      </span>
      <span class="list-check">
        ${done.includes(number) ? '✓' : '›'}
      </span>
    `;

    if (done.includes(number)) {
      button.classList.add('completed');
    }

    button.dataset.id = number;

    button.addEventListener('click', () => openStudy(number));
    container.appendChild(button);
  }

  showView('list');
}

// --------------------------------------------------
// 학습 화면
// --------------------------------------------------

function openStudy(number) {
  if (number < 1 || number > TOTAL) return;

  id = number;
  addRecent(number);

  renderStudy();
  renderHome();
  showView('study');

  playAudio(number);
}

function renderStudy() {
  const story = stories[id - 1];

  if (!story) return;

  $('#studyPosition').textContent = `${id} / ${TOTAL}`;
  $('#storyTitle').textContent = story.title || `${id}번 동화`;

  $('#studyDoneBadge').classList.toggle('hidden', !done.includes(id));

  $('#prevBtn').disabled = id <= 1;
  $('#nextBtn').disabled = id >= TOTAL;

  document.querySelectorAll('.mode-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.mode === mode);
  });

  const content = $('#storyContent');

  if (!story.lines.length) {
    content.innerHTML = `
      <p class="empty-message">
        이 동화의 내용을 아직 나누지 못했어요.<br>
        story67.txt 파일을 보내주면 번호별로 정확하게 구분해 줄게요.
      </p>
    `;
    return;
  }

  const visibleLines = story.lines.filter((line) => {
    if (mode === 'en') return line.lang === 'en';
    if (mode === 'ko') return line.lang === 'ko';
    return line.lang === 'en' || line.lang === 'ko';
  });

  content.innerHTML = visibleLines.map((line) => `
    <p class="story-line ${line.lang === 'ko' ? 'korean-line' : 'english-line'}">
      ${escapeHTML(line.text)}
    </p>
  `).join('');
}

function saveCurrent() {
  if (!done.includes(id)) {
    done = [...done, id].sort((a, b) => a - b);
  }

  saveProgress();
  renderStudy();
  renderHome();

  if (!list.classList.contains('hidden')) {
    openList(start, end);
  }

  toast('✓ 학습 완료로 저장했어요!');
}

function setMode(nextMode) {
  mode = nextMode;
  renderStudy();
}

// --------------------------------------------------
// 음성 플레이어
// --------------------------------------------------

function audioPath(number) {
  return `${AUDIO_DIR}s${pad(number)}.mp3`;
}

function playAudio(number) {
  const path = audioPath(number);

  $('#audioTitle').textContent =
    `${number}번 · ${stories[number - 1]?.title || '동화'}`;

  $('#audioStatus').textContent = '음성 파일 준비 중';

  audio.src = path;
  audio.playbackRate = speed;
  audio.load();

  audio.play().then(() => {
    $('#audioStatus').textContent = '재생 중';
  }).catch(() => {
    $('#audioStatus').textContent = '재생 버튼을 눌러주세요';
  });
}

audio.addEventListener('play', () => {
  $('#audioStatus').textContent = '재생 중';
});

audio.addEventListener('pause', () => {
  if (!audio.ended) {
    $('#audioStatus').textContent = '일시정지';
  }
});

audio.addEventListener('ended', () => {
  $('#audioStatus').textContent = '재생 완료';
});

$('#speedSelect').addEventListener('change', (event) => {
  speed = Number(event.target.value);
  audio.playbackRate = speed;
  toast(`재생 속도 ${speed}배`);
});

// --------------------------------------------------
// 버튼 이벤트
// --------------------------------------------------

document.querySelectorAll('.range-btn').forEach((button) => {
  button.addEventListener('click', () => {
    start = Number(button.dataset.start);
    end = Number(button.dataset.end);

    document.querySelectorAll('.range-btn').forEach((item) => {
      item.classList.toggle('active', item === button);
    });

    renderHome();
  });
});

document.querySelectorAll('.mode-btn').forEach((button) => {
  button.addEventListener('click', () => {
    setMode(button.dataset.mode);
  });
});

$('#backHomeBtn').addEventListener('click', () => {
  showView('home');
});

$('#backListBtn').addEventListener('click', () => {
  openList(start, end);
});

$('#saveBtn').addEventListener('click', saveCurrent);

$('#prevBtn').addEventListener('click', () => {
  if (id > 1) openStudy(id - 1);
});

$('#nextBtn').addEventListener('click', () => {
  if (id < TOTAL) openStudy(id + 1);
});

$('#continueBtn').addEventListener('click', () => {
  openStudy(recent[0] || 1);
});

$('#resetProgressBtn').addEventListener('click', () => {
  const confirmed = confirm(
    '저장된 학습 완료 표시와 최근 학습 기록을 모두 초기화할까요?'
  );

  if (!confirmed) return;

  done = [];
  recent = [];
  saveProgress();
  renderHome();
  renderStudy();
  toast('학습 기록을 초기화했어요.');
});

// --------------------------------------------------
// 시작
// --------------------------------------------------

initializeStories();
