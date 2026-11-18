const CACHE_PREFIX = "calculadora-quimio-";
const CACHE_NAME = `${CACHE_PREFIX}v2`;
const workerLocation = self.location || self.registration?.scope;
const workerURL = workerLocation ? new URL(workerLocation) : null;
const developmentHost =
  !workerURL ||
  /^(localhost|127(?:\.\d+){3}|\[::1\]|0\.0\.0\.0)$/.test(workerURL.hostname) ||
  /\.(localhost|manus\.computer|manuspreviews\.space|manuspreviews\.com)$/.test(
    workerURL.hostname
  ) ||
  /^(manus\.computer|manuspreviews\.space|manuspreviews\.com)$/.test(
    workerURL.hostname
  );

const publicResources = new Map([
  ["/manifest.json", "manifest"],
  ["/manifest.webmanifest", "manifest"],
  ["/favicon.ico", "ico"],
  ["/icon-192.png", "png"],
  ["/icon-512.png", "png"],
  ["/apple-touch-icon.png", "png"],
]);

function resourceKind(url) {
  if (url.search) return null;
  const asset = url.pathname.match(
    /^\/assets\/[\w.-]+-[A-Za-z0-9_-]{8,}\.(js|css|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|wasm)$/
  );
  return asset ? asset[1] : publicResources.get(url.pathname);
}

function canCache(response, kind) {
  if (
    !response ||
    response.status !== 200 ||
    response.type !== "basic" ||
    response.redirected
  ) {
    return false;
  }
  const control = response.headers.get("Cache-Control") || "";
  const vary = response.headers.get("Vary") || "";
  if (
    /\b(private|no-store|no-cache)\b/i.test(control) ||
    /(^|,)\s*(cookie|authorization|\*)\s*(,|$)/i.test(vary) ||
    response.headers.has("Set-Cookie")
  ) {
    return false;
  }
  const mime = (response.headers.get("Content-Type") || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (kind === "html") {
    // Never persist personalized HTML. Only the public root shell is eligible.
    return mime === "text/html" && /(^|,)\s*public\s*(,|$)/i.test(control);
  }
  if (kind === "js")
    return /^(text|application)\/(javascript|ecmascript)$/.test(mime);
  if (kind === "css") return mime === "text/css";
  if (kind === "manifest")
    return ["application/manifest+json", "application/json"].includes(mime);
  if (kind === "svg") return mime === "image/svg+xml";
  if (kind === "ico")
    return ["image/x-icon", "image/vnd.microsoft.icon"].includes(mime);
  if (kind === "jpg" || kind === "jpeg") return mime === "image/jpeg";
  if (["png", "gif", "webp", "avif"].includes(kind))
    return mime === `image/${kind}`;
  if (kind === "woff" || kind === "woff2")
    return mime === `font/${kind}` || mime === "application/font-woff";
  if (kind === "ttf" || kind === "otf") return mime === `font/${kind}`;
  return kind === "wasm" && mime === "application/wasm";
}

async function cachedResponse(request, kind) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(request);
    return canCache(response, kind) ? response : undefined;
  } catch {
    // Cache Storage may be unavailable; the network must still work.
    return undefined;
  }
}

async function storeResponse(request, response, kind) {
  if (!canCache(response, kind)) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  } catch {
    // A storage/quota failure must not replace a successful network response.
  }
}

async function staticResponse(request, kind) {
  const cached = await cachedResponse(request, kind);
  if (cached) return cached;
  const response = await fetch(request);
  if (
    /^(text\/html|application\/xhtml\+xml)(?:;|$)/i.test(
      response.headers.get("Content-Type") || ""
    )
  ) {
    throw new TypeError("Unexpected HTML for a static resource");
  }
  await storeResponse(request, response, kind);
  return response;
}

async function navigationResponse(request, url) {
  try {
    const response = await fetch(request);
    // Routes and query parameters may contain patient data. Never persist them.
    if (
      !url.search &&
      (url.pathname === "/" || url.pathname === "/index.html")
    ) {
      await storeResponse(request, response, "html");
    }
    return response;
  } catch (error) {
    // HTML fallback is exclusive to navigation, never scripts or other assets.
    const cached =
      (await cachedResponse(request, "html")) ||
      (await cachedResponse(new URL("/", workerURL).href, "html")) ||
      (await cachedResponse(new URL("/index.html", workerURL).href, "html"));
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener("install", event => {
  // No eager HTML fetch: installation must never cache authenticated pages,
  // including when a stale worker is installed on a development/preview host.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (developmentHost || request.method !== "GET") return;
  const url = new URL(request.url);
  if (
    url.origin !== workerURL.origin ||
    request.headers.has("Authorization") ||
    request.headers.has("Cookie")
  )
    return;
  // Development modules must go directly to the browser's network loader,
  // even if a previous worker cached another Vite dependency version.
  if (
    /^\/(?:@vite|@fs|@id|src|node_modules)(?:\/|$)/.test(url.pathname) ||
    /^\/(?:api|trpc)(?:\/|$)/.test(url.pathname)
  )
    return;

  if (request.mode === "navigate") {
    event.respondWith(navigationResponse(request, url));
    return;
  }
  const kind = resourceKind(url);
  if (kind) event.respondWith(staticResponse(request, kind));
});
