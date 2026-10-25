
/* =========================================
   리틀팍스 동화 레벨 2
   service-worker.js
========================================= */

const CACHE_NAME = "little02-cache-v2";

const APP_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

/* =========================================
   설치: 주요 파일 캐싱
========================================= */

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // 개별 파일이 없더라도 설치 전체가 실패하지 않도록 처리
      await Promise.all(
        APP_FILES.map(async (url) => {
          try {
            const response = await fetch(url, {
              cache: "reload"
            });

            if (response.ok) {
              await cache.put(url, response);
            }
          } catch (error) {
            console.warn("캐시 생략:", url);
          }
        })
      );

      await self.skipWaiting();
    })()
  );
});

/* =========================================
   활성화: 이전 버전 캐시 정리
========================================= */

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();

      await Promise.all(
        cacheNames.map(async (name) => {
          if (
            name.startsWith("little02-cache-") &&
            name !== CACHE_NAME
          ) {
            await caches.delete(name);
          }
        })
      );

      await self.clients.claim();
    })()
  );
});

/* =========================================
   요청 처리
   - HTML은 네트워크 우선
   - 기타 파일은 캐시 우선
========================================= */

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // 다른 도메인은 처리하지 않음
  if (url.origin !== self.location.origin) {
    return;
  }

  // HTML 페이지: 최신 페이지 우선
  if (
    request.mode === "navigate" ||
    url.pathname.endsWith("/index.html")
  ) {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);

          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put("./index.html", response.clone());
          }

          return response;
        } catch (error) {
          const cached =
            await caches.match(request) ||
            await caches.match("./index.html") ||
            await caches.match("./");

          if (cached) {
            return cached;
          }

          return new Response(
            "오프라인 상태입니다. 인터넷 연결 후 다시 시도해 주세요.",
            {
              status: 503,
              headers: {
                "Content-Type": "text/plain; charset=utf-8"
              }
            }
          );
        }
      })()
    );

    return;
  }

  // 기타 파일: 캐시 우선, 없으면 네트워크
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);

      if (cached) {
        return cached;
      }

      try {
        const response = await fetch(request);

        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }

        return response;
      } catch (error) {
        return new Response(
          "파일을 불러올 수 없습니다. 인터넷 연결을 확인해 주세요.",
          {
            status: 503,
            headers: {
              "Content-Type": "text/plain; charset=utf-8"
            }
          }
        );
      }
    })()
  );
});
