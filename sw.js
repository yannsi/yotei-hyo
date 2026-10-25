// つたえる帳（予定表・メモ）：一度開いたら、ページと部品を端末に保存してオフラインでも開けるようにする
const VERSION = "yotei-hyo-v7";
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./lib/qrcode.js", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];
const FONTS = "yotei-hyo-fonts";

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  // 同じ yannsi.github.io にある他の作品の保存は消さない（自分の古い版だけ消す）
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("yotei-hyo-") && k !== VERSION && k !== FONTS).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // 文字の形（Google Fonts）：使ったぶんだけ保存しておく
  if (url.host === "fonts.googleapis.com" || url.host === "fonts.gstatic.com") {
    e.respondWith(caches.open(FONTS).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(r => { if (r.ok || r.type === "opaque") c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin !== location.origin) return;

  // ページ：ネットがあれば最新、3秒待っても来なければ（圏外なら）保存したもの
  // ※予定やメモはURLの「#」より後ろに入っているので、サーバーには届かない
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const cached = await caches.match("./index.html");
      const net = fetch(req).then(r => {
        if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put("./index.html", copy)); }
        return r;
      });
      if (!cached) return net;
      return Promise.race([net.catch(() => cached), new Promise(ok => setTimeout(() => ok(cached), 3000))]);
    })());
    return;
  }

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return r;
    }))
  );
});
