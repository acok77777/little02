
'use strict';

// ========================================
// 리틀팍스 동화 레벨 2 설정
// ========================================
const TOTAL = 67;
const AUDIO_DIR = './s67/';
const DATA_FILES = [
  './data/story67.txt',
  './메모장w67.txt',
  './data/메모장w67.txt'
];

const $ = selector => document.querySelector(selector);

const load = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};

const esc = value =>
  String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);

// ★ 음성 파일명: s01.mp3 ~ s67.mp3
const pad = number => String(number).padStart(2, '0');

const audioPath = number =>
  `${AUDIO_DIR}s${pad(number)}.mp3`;

// ========================================
// 앱 상태
// ========================================
let stories = Array.from(
  { length: TOTAL },
  (_, index) => ({
    id: index + 1,
    title: `${index + 1}번 동화`,
    lines: []
  })
);

let done = load('lf2_done', []);
let recent = load('lf2_recent', []);

let id = 1;
let start = 1;
let end = 20;
let mode = 'both';
let speed = 1;
let toastTimer;

// 화면
const home = $('#homeView');
const list = $('#listView');
const study = $('#studyView');
const audio = $('#audio');

// ========================================
// 공통 기능
// ========================================
function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('show');

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    element.classList.remove('show');
  }, 2000);
}

function view(target) {
  [home, list, study].forEach(element => {
    element.classList.add('hidden');
  });

  target.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ========================================
// 동화 텍스트 파일 읽기
//
// 권장 형식:
//
// 1 | The New Teacher
// EN: This is a story.
// KO: 이것은 이야기입니다.
//
// 2 | A Good Friend
// EN: I have a good friend.
// KO: 나에게는 좋은 친구가 있습니다.
// ========================================
function parse(raw) {
  const map = new Map();
  let active = null;

  const lines = raw
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/);

  for (const rawLine of lines) {
    const text = rawLine.trim();

    if (!text || text.startsWith('#')) {
      continue;
    }

    // 단원 제목 형식
    const match = text.match(
      /^\s*(?:\[(\d{1,2})\]|(\d{1,2})\s*(?:번\s*)?(?:[.|:：、-]\s*|\s+))(.+?)\s*$/
    );

    const alternative = text.match(
      /^\s*(?:단원|동화|story|lesson)\s*(\d{1,2})\s*[:：-]\s*(.+)$/i
    );

    const number = match
      ? Number(match[1] || match[2])
      : alternative
        ? Number(alternative[1])
        : 0;

    if (number >= 1 && number <= TOTAL) {
      const title = match
        ? match[3]
        : alternative[2];

      active = {
        id: number,
        title: title.replace(/^제목\s*[:：]\s*/, '').trim(),
        lines: []
      };

      map.set(number, active);
      continue;
    }

    // 숫자만 한 줄에 적힌 형식도 지원
    const numberOnly = text.match(/^\[?(\d{1,2})번?\]?$/);

    if (!active && numberOnly) {
      const n = Number(numberOnly[1]);

      if (n >= 1 && n <= TOTAL) {
        active = {
          id: n,
          title: `${n}번 동화`,
          lines: []
        };

        map.set(n, active);
      }

      continue;
    }

    if (!active) continue;

    // 제목이 별도 줄에 있는 경우
    if (/^제목\s*[:：]/.test(text)) {
      active.title = text
        .replace(/^제목\s*[:：]\s*/, '')
        .trim();

      continue;
    }

    const english = text.match(
      /^(?:EN|ENG|영어)\s*[:：]\s*(.+)$/i
    );

    const korean = text.match(
      /^(?:KO|KOR|해석|번역|우리말)\s*[:：]\s*(.+)$/i
    );

    const paired = text.match(/^(.+?)\s*\|\|\s*(.+)$/);

    if (english) {
      active.lines.push({
        type: 'en',
        text: english[1]
      });
    } else if (korean) {
      active.lines.push({
        type: 'ko',
        text: korean[1]
      });
    } else if (paired) {
      active.lines.push(
        { type: 'en', text: paired[1].trim() },
        { type: 'ko', text: paired[2].trim() }
      );
    } else {
      active.lines.push({
        type: 'auto',
        text: text.replace(/^[-•*]\s*/, '')
      });
    }
  }

  // EN/KO 라벨이 없는 문장은 영어, 해석 순으로 처리
  for (const story of map.values()) {
    let index = 0;

    story.lines = story.lines.map(line => {
      if (line.type !== 'auto') return line;

      return {
        type: index++ % 2 === 0 ? 'en' : 'ko',
        text: line.text
      };
    });
  }

  return map;
}

async function loadData() {
  for (const path of DATA_FILES) {
    try {
      const response = await fetch(path);

      if (!response.ok) continue;

      const raw = await response.text();
      const parsed = parse(raw);

      parsed.forEach((story, number) => {
        stories[number - 1] = story;
      });

      break;
    } catch (error) {
      console.warn('텍스트 파일 확인:', path, error);
    }
  }

  renderHome();

  if (!study.classList.contains('hidden')) {
    renderStudy();
  }
}

// ========================================
// 메인 화면
// ========================================
function renderHome() {
  const count = done.length;

  $('#progressText').textContent =
    `${count} / ${TOTAL} 완료`;

  $('#progressFill').style.width =
    `${count / TOTAL * 100}%`;

  $('#progressSub').textContent =
    count === TOTAL
      ? '67개 동화를 모두 학습했어요!'
      : `앞으로 ${TOTAL - count}개 동화를 더 학습할 수 있어요.`;

  document.querySelectorAll('.range-card').forEach(button => {
    const first = Number(button.dataset.start);
    const last = Number(button.dataset.end);

    const completed = done.filter(number =>
      number >= first && number <= last
    ).length;

    button.querySelector('small').textContent =
      `${completed}/${last - first + 1} 완료 · 학습하기`;
  });

  const ids = recent
    .filter((number, index, array) =>
      array.indexOf(number) === index
    )
    .slice(0, 3);

  $('#recentList').innerHTML = ids.length
    ? ids.map(number => `
        <button class="recent-item" data-id="${number}">
          <span class="story-number">${pad(number)}</span>
          <strong>${esc(stories[number - 1].title)}</strong>
          ${
            done.includes(number)
              ? '<span class="check">✓ 완료</span>'
              : '<span>이어하기 →</span>'
          }
        </button>
      `).join('')
    : '아직 학습한 동화가 없어요.';
}

// ========================================
// 단원 목록
// ========================================
function openList(first = 1, last = 20) {
  start = first;
  end = last;

  $('#listTitle').textContent =
    `${first}~${last}번 동화`;

  $('#listSubtitle').textContent =
    `${done.filter(number =>
      number >= first && number <= last
    ).length} / ${last - first + 1}개 학습 완료`;

  $('#storyList').innerHTML = stories
    .slice(first - 1, last)
    .map(story => `
      <button class="story-row" data-id="${story.id}">
        <span class="story-number">${pad(story.id)}</span>
        <span class="story-name">${esc(story.title)}</span>
        ${
          done.includes(story.id)
            ? '<span class="check">✓</span>'
            : '<span>›</span>'
        }
      </button>
    `).join('');

  view(list);
}

// ========================================
// 학습 화면 열기
// ========================================
function openStudy(number) {
  id = Math.max(1, Math.min(TOTAL, Number(number)));

  recent = [
    id,
    ...recent.filter(number => number !== id)
  ].slice(0, 10);

  localStorage.setItem(
    'lf2_recent',
    JSON.stringify(recent)
  );

  audio.pause();
  audio.src = audioPath(id);
  audio.playbackRate = 1;
  speed = 1;
  mode = 'both';

  document.querySelectorAll('.mode-tab').forEach(button => {
    button.classList.toggle(
      'active',
      button.dataset.mode === mode
    );
  });

  renderStudy();
  view(study);
}

// ========================================
// 학습 내용 표시
// ========================================
function renderStudy() {
  const story = stories[id - 1];

  $('#studyNumber').textContent = pad(id);
  $('#studyTitle').textContent = story.title;

  const saved = done.includes(id);

  $('#headerSaved').textContent =
    saved ? '✓ 저장됨' : '♡ 저장';

  $('#headerSaved').classList.toggle('saved', saved);

  $('#saveBtn').textContent = saved
    ? '✓ 학습 완료 · 저장 취소'
    : '♡ 이 동화 저장하기';

  $('#saveBtn').classList.toggle('saved', saved);

  $('#prevBtn').disabled = id === 1;
  $('#nextBtn').disabled = id === TOTAL;

  $('#speedValue').textContent = `${speed.toFixed(1)}×`;
  $('#slowerBtn').disabled = speed <= 0.5;
  $('#fasterBtn').disabled = speed >= 2.5;

  const visible = story.lines.filter(line =>
    mode === 'both' || line.type === mode
  );

  let content = `
    <div class="content-title">
      제목: (${esc(story.title)})
    </div>
  `;

  if (visible.length) {
    content += visible.map(line => `
      <div class="line-card ${
        line.type === 'ko' ? 'korean' : 'english'
      }">
        <div class="line-text">${esc(line.text)}</div>
      </div>
    `).join('');
  } else {
    content += `
      <p class="empty-content">
        텍스트가 없어요. data/story67.txt 파일을 확인하세요.
      </p>
    `;
  }

  $('#storyContent').innerHTML = content;
  $('#storyContent').scrollTop = 0;

  renderHome();
}

// ========================================
// 학습 완료 저장 / 취소
// ========================================
function saveCurrent() {
  if (done.includes(id)) {
    done = done.filter(number => number !== id);
  } else {
    done = [...done, id].sort((a, b) => a - b);
  }

  localStorage.setItem('lf2_done', JSON.stringify(done));

  renderStudy();

  if (!list.classList.contains('hidden')) {
    openList(start, end);
  }

  toast(
    done.includes(id)
      ? '학습 완료로 저장했어요.'
      : '완료 표시를 취소했어요.'
  );
}

// ========================================
// 재생 속도
// 최소 0.5× / 최대 2.5× / 0.5씩 변경
// ========================================
function changeSpeed(delta) {
  speed = Math.max(
    0.5,
    Math.min(2.5, Math.round((speed + delta) * 10) / 10)
  );

  audio.playbackRate = speed;

  $('#speedValue').textContent = `${speed.toFixed(1)}×`;
  $('#slowerBtn').disabled = speed <= 0.5;
  $('#fasterBtn').disabled = speed >= 2.5;
}

// ========================================
// 오디오 시간 표시
// ========================================
function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '00:00';
  }

  return (
    String(Math.floor(seconds / 60)).padStart(2, '0') +
    ':' +
    String(Math.floor(seconds % 60)).padStart(2, '0')
  );
}

// ========================================
// 버튼 이벤트
// ========================================
document.querySelectorAll('.range-card').forEach(button => {
  button.addEventListener('click', () => {
    openList(
      Number(button.dataset.start),
      Number(button.dataset.end)
    );
  });
});

$('#homeBtn').addEventListener('click', () => {
  audio.pause();
  view(home);
  renderHome();
});

$('#listBackBtn').addEventListener('click', () => {
  view(home);
});

function backToList() {
  audio.pause();
  openList(start, end);
}

$('#studyBackBtn').addEventListener('click', backToList);
$('#backToListBtn').addEventListener('click', backToList);

$('#showAllBtn').addEventListener('click', () => {
  openList(1, 67);
});

$('#storyList').addEventListener('click', event => {
  const button = event.target.closest('[data-id]');

  if (button) {
    openStudy(Number(button.dataset.id));
  }
});

$('#recentList').addEventListener('click', event => {
  const button = event.target.closest('[data-id]');

  if (button) {
    openStudy(Number(button.dataset.id));
  }
});

$('#prevBtn').addEventListener('click', () => {
  if (id > 1) openStudy(id - 1);
});

$('#nextBtn').addEventListener('click', () => {
  if (id < TOTAL) openStudy(id + 1);
});

$('#saveBtn').addEventListener('click', saveCurrent);
$('#headerSaved').addEventListener('click', saveCurrent);

$('#slowerBtn').addEventListener('click', () => {
  changeSpeed(-0.5);
});

$('#fasterBtn').addEventListener('click', () => {
  changeSpeed(0.5);
});

document.querySelectorAll('.mode-tab').forEach(button => {
  button.addEventListener('click', () => {
    mode = button.dataset.mode;

    document.querySelectorAll('.mode-tab').forEach(tab => {
      tab.classList.toggle('active', tab === button);
    });

    renderStudy();
  });
});

// ========================================
// 학습 기록 초기화
// ========================================
$('#resetProgressBtn').addEventListener('click', () => {
  if (confirm('학습 완료 기록을 모두 초기화할까요?')) {
    done = [];
    recent = [];

    localStorage.removeItem('lf2_done');
    localStorage.removeItem('lf2_recent');

    renderHome();
    renderStudy();

    toast('학습 기록을 초기화했어요.');
  }
});

// ========================================
// 오디오 재생 / 일시정지
// ========================================
$('#playBtn').addEventListener('click', async () => {
  try {
    if (audio.paused) {
      await audio.play();
      $('#audioStatus').textContent = '듣고 따라 말해 보세요.';
    } else {
      audio.pause();
    }
  } catch {
    $('#audioStatus').textContent =
      `음성 파일 확인: s67/s${pad(id)}.mp3`;
  }
});

audio.addEventListener('play', () => {
  $('#playBtn').textContent = 'Ⅱ';
});

audio.addEventListener('pause', () => {
  $('#playBtn').textContent = '▶';
});

audio.addEventListener('loadedmetadata', () => {
  $('#duration').textContent = formatTime(audio.duration);
  $('#audioStatus').textContent = '';
});

audio.addEventListener('timeupdate', () => {
  if (audio.duration) {
    $('#currentTime').textContent = formatTime(audio.currentTime);

    $('#seekBar').value =
      audio.currentTime / audio.duration * 100;
  }
});

audio.addEventListener('error', () => {
  $('#audioStatus').textContent =
    `음성 파일 없음: s67/s${pad(id)}.mp3`;
});

// 재생 막대 이동
$('#seekBar').addEventListener('input', () => {
  if (audio.duration) {
    audio.currentTime =
      Number($('#seekBar').value) / 100 * audio.duration;
  }
});

// ========================================
// PWA 서비스 워커
// ========================================
if ('serviceWorker' in navigator &&
    location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./service-worker.js')
      .catch(error => console.warn('서비스 워커 등록 실패:', error));
  });
}

// ========================================
// 앱 시작
// ========================================
renderHome();
loadData();
