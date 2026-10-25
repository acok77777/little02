# 리틀팍스 동화 레벨 2

## 폴더 구조
```text
littlefox-level2/
├── index.html
├── style.css
├── app.js
├── manifest.json
├── service-worker.js
├── icon-192.png
├── icon-512.png
├── data/
│   └── story67.txt
└── s67/
    ├── 001.mp3
    ├── 002.mp3
    └── ... 067.mp3
```

## 꼭 넣어야 하는 원본 파일
- 기존 `메모장w67` 내용을 `data/story67.txt`로 저장하세요.
- 67개 음성 파일을 `s67/001.mp3` ~ `s67/067.mp3` 이름으로 넣으세요. 파일 이름이 다르면 `app.js`의 `audioPath()`를 수정하세요.
- 텍스트는 `1 | The New Teacher` 같은 단원 제목 줄과 `EN: 영어 문장`, `KO: 우리말 해석` 형식을 권장합니다. 예시는 `data/story67.txt`에 있습니다. 실제 원본 형식이 다르면 파서 수정이 필요할 수 있습니다.

## GitHub Pages
1. 파일을 저장소 최상위(root)에 업로드합니다.
2. `data/story67.txt`와 `s67` 음성 파일을 업로드합니다.
3. GitHub 저장소 Settings → Pages → Deploy from a branch → `main` → `/(root)` → Save.
4. `https://사용자명.github.io/저장소명/`으로 접속합니다.

## 기능
- 1~20, 21~40, 41~60, 61~67번 단원 목록
- 오디오 플레이어: 재생/일시정지, 탐색 막대, 0.5×~2.5× 속도
- 영어+해석/영어만/해석만 표시
- 학습 완료 체크, 최근 학습 목록, 진행률 저장
- PWA manifest, 서비스 워커, 192/512 아이콘

학습 체크는 현재 브라우저에 저장되며 기기 간 동기화되지 않습니다. 저장소가 공개이면 텍스트와 음성 파일도 공개되므로 공유 권한을 확인하세요.
