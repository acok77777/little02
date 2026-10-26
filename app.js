
function parseStories(rawText) {
  const lines = rawText
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(line => line.trim());

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

  for (const line of lines) {
    if (!line) continue;

    // 독립된 숫자 줄로 동화 시작 확인
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

    if (!storyNumber) continue;

    const story = parsed.get(storyNumber);

    // 새 제목 형식
    const titleMatch = line.match(/^제목:\s*(.+)$/);

    if (titleMatch) {
      story.title = titleMatch[1].trim();
      titleFound = true;
      koreanTitlePending = true;
      continue;
    }

    // 이전 제목 형식도 지원
    const oldTitleMatch = line.match(
      /^My First Readers\s*2\s*,\s*(.+)$/i
    );

    if (oldTitleMatch) {
      story.title = oldTitleMatch[1].trim();
      titleFound = true;
      koreanTitlePending = true;
      continue;
    }

    if (!titleFound) continue;

    // 제목 바로 다음의 한글 번역 제목 제외
    if (koreanTitlePending) {
      if (/^[（(].*[）)]$/.test(line)) {
        koreanTitlePending = false;
        continue;
      }

      if (/^[가-힣].*$/.test(line)) {
        koreanTitlePending = false;
        continue;
      }

      koreanTitlePending = false;
    }

    // 웹페이지 안내 및 저작권 문구 제거
    if (
      /학습자료|원문해석|글자 확대|글자 축소|인쇄/.test(line) ||
      /원문 숨기기|원문 보이기|해석 숨기기|해석 보이기/.test(line) ||
      /원문 내용 중 단어를 클릭하면/.test(line) ||
      /All rights reserved/i.test(line) ||
      /www\.littlefox\.co\.kr/i.test(line) ||
      /©\s*2000-2026/i.test(line)
    ) {
      continue;
    }

    if (/^\[L\d+\]/.test(line)) continue;
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
