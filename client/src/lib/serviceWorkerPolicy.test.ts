import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("../../public/sw.js", import.meta.url)),
  "utf8",
);
const origin = "https://calculadora.example";
const scriptPath = "/assets/index-DrQXfBoT.js";
const cssPath = "/assets/index-CG25Br_C.css";

// Only browser I/O is replaced: every test runs the actual sw.js listeners.
function response(
  body: string,
  contentType = "text/javascript",
  headers: Record<string, string> = {},
  type = "basic",
  status = 200,
): Response {
  function withBrowserType(value: Response): Response {
    const clone = value.clone.bind(value);
    Object.defineProperty(value, "type", { value: type });
    Object.defineProperty(value, "clone", {
      value: () => withBrowserType(clone()),
    });
    return value;
  }
  return withBrowserType(
    new Response(body, {
      status,
      headers: { "Content-Type": contentType, ...headers },
    }),
  );
}

function request(
  path: string,
  options: RequestInit & { destination?: string } = {},
): Request {
  const { destination = "", mode, ...init } = options;
  const value = new Request(new URL(path, origin), init);
  if (mode) Object.defineProperty(value, "mode", { value: mode });
  Object.defineProperty(value, "destination", { value: destination });
  return value;
}

function worker(location = `${origin}/sw.js`) {
  const listeners = new Map<string, (event: any) => void>();
  const stores = new Map<string, Map<string, Response>>();
  const writes: string[] = [];
  const key = (input: Request | string) =>
    new URL(typeof input === "string" ? input : input.url, location).href;
  const fetch = vi.fn(async (input: Request | string) =>
    response(`network:${key(input)}`),
  );
  const caches = {
    open: vi.fn(async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      return {
        match: async (input: Request | string) => store.get(key(input))?.clone(),
        put: async (input: Request | string, value: Response) => {
          if (typeof input !== "string" && input.method !== "GET") {
            throw new TypeError("Cache.put only supports GET");
          }
          writes.push(key(input));
          store.set(key(input), value.clone());
        },
        addAll: async (inputs: string[]) => {
          for (const input of inputs) {
            writes.push(key(input));
            store.set(key(input), (await fetch(input)).clone());
          }
        },
      };
    }),
    match: vi.fn(async (input: Request | string) => {
      for (const store of stores.values()) {
        const found = store.get(key(input));
        if (found) return found.clone();
      }
    }),
    keys: vi.fn(async () => [...stores.keys()]),
    delete: vi.fn(async (name: string) => stores.delete(name)),
  };
  const skipWaiting = vi.fn(async () => {});
  const claim = vi.fn(async () => {});
  runInNewContext(source, {
    self: {
      location: new URL(location),
      registration: { scope: new URL("/", location).href },
      addEventListener: (name: string, listener: (event: any) => void) =>
        listeners.set(name, listener),
      skipWaiting,
      clients: { claim },
    },
    caches,
    fetch,
    URL,
    Response,
    console: { log: () => {}, error: () => {} },
  });

  return {
    stores,
    writes,
    fetch,
    caches,
    seed(name: string, path: string, value: Response) {
      if (!stores.has(name)) stores.set(name, new Map());
      stores.get(name)!.set(key(path), value.clone());
    },
    async lifecycle(name: "install" | "activate") {
      const waits: Promise<unknown>[] = [];
      listeners.get(name)!({
        waitUntil: (value: Promise<unknown>) => waits.push(value),
      });
      await Promise.all(waits);
    },
    async dispatch(input: Request) {
      const waits: Promise<unknown>[] = [];
      let result: Promise<Response> | undefined;
      let intercepted = false;
      listeners.get("fetch")!({
        request: input,
        respondWith: (value: Promise<Response>) => {
          intercepted = true;
          result = Promise.resolve(value);
        },
        waitUntil: (value: Promise<unknown>) => waits.push(value),
      });
      // No respondWith means the browser, not the worker, performs the fetch.
      const value = await (result ?? fetch(input));
      await Promise.all(waits);
      return { intercepted, response: value };
    },
  };
}

const publicShell = (body: string) =>
  response(body, "text/html; charset=utf-8", { "Cache-Control": "public, max-age=0" });

// Mutations caught: broad cache-first, missing origin/API/dev/query guards,
// HTML catch-all, unsafe MIME/privacy writes, global cache deletion.
describe("service worker cache policy (real event handlers)", () => {
  it.each([
    "/@vite/client",
    "/@vite/deps/react-dom_client.js?v=ced61b0b",
    "/@fs/home/ubuntu/node_modules/react/index.js?v=389b4afb",
    "/@id/react",
    "/src/main.tsx",
    "/src/components/ui/dialog.tsx?t=123",
    "/node_modules/.vite/deps/chunk-react.js?v=389b4afb",
    "/node_modules/react/index.js",
    "/assets/react.js?v=389b4afb",
    `${scriptPath}?v=389b4afb`,
    "/legacy.js",
    "/assets/unfingerprinted.js",
  ])("bypasses %s despite a cached development module", async (path) => {
    const sw = worker();
    sw.seed("calculadora-quimio-v1", path, response("stale React"));
    const result = await sw.dispatch(request(path, { destination: "script" }));
    expect(result.intercepted).toBe(false);
    expect(await result.response.text()).toBe(`network:${origin}${path}`);
    expect(sw.writes).toEqual([]);
    expect(sw.caches.match).not.toHaveBeenCalled();
    expect(sw.caches.open).not.toHaveBeenCalled();
  });

  it.each([
    "/api/patients",
    "/api/trpc/patient.list?batch=1",
    "/api",
    "/trpc/patient.list",
    "/trpc",
    "/api/assets/index-DrQXfBoT.js",
  ])("never intercepts or caches API %s, even navigation with cookies", async (path) => {
    const sw = worker();
    sw.seed("calculadora-quimio-v1", path, response("patient data"));
    const result = await sw.dispatch(
      request(path, { mode: "navigate", headers: { Cookie: "session=secret" } }),
    );
    expect(result.intercepted).toBe(false);
    expect(await result.response.text()).toBe(`network:${origin}${path}`);
    expect(sw.writes).toEqual([]);
    expect(sw.caches.open).not.toHaveBeenCalled();
  });

  it.each(["POST", "PUT", "PATCH", "DELETE", "HEAD"])(
    "bypasses all %s requests",
    async (method) => {
      const sw = worker();
      const result = await sw.dispatch(request(scriptPath, { method }));
      expect(result.intercepted).toBe(false);
      expect(sw.writes).toEqual([]);
    },
  );

  it("never intercepts third-party static assets", async () => {
    const sw = worker();
    const path = "https://cdn.example/assets/index-DrQXfBoT.js";
    const result = await sw.dispatch(request(path));
    expect(result.intercepted).toBe(false);
    expect(sw.writes).toEqual([]);
  });

  it("bypasses requests with Authorization instead of reading stale cache", async () => {
    const sw = worker();
    sw.seed("calculadora-quimio-v1", scriptPath, response("stale"));
    const result = await sw.dispatch(
      request(scriptPath, { headers: { Authorization: "Bearer secret" } }),
    );
    expect(result.intercepted).toBe(false);
    expect(sw.writes).toEqual([]);
  });

  it("serves fresh navigation HTML before cache and stores only a public shell", async () => {
    const sw = worker();
    sw.fetch.mockResolvedValueOnce(publicShell("old shell"));
    await sw.dispatch(request("/", { mode: "navigate" }));
    sw.fetch.mockResolvedValueOnce(publicShell("new shell"));
    const result = await sw.dispatch(request("/", { mode: "navigate" }));
    expect(result.intercepted).toBe(true);
    expect(await result.response.text()).toBe("new shell");
    expect(sw.fetch).toHaveBeenCalledTimes(2);
    sw.fetch.mockRejectedValueOnce(new Error("offline"));
    const offline = await sw.dispatch(request("/", { mode: "navigate" }));
    expect(await offline.response.text()).toBe("new shell");
  });

  it("uses the cached public shell only as a navigation fallback", async () => {
    const sw = worker();
    sw.fetch.mockResolvedValueOnce(publicShell("offline shell"));
    await sw.dispatch(request("/", { mode: "navigate" }));
    sw.fetch.mockRejectedValueOnce(new Error("offline"));
    const result = await sw.dispatch(request("/calculator", { mode: "navigate" }));
    expect(await result.response.text()).toBe("offline shell");
    expect(sw.writes).toEqual([`${origin}/`]);
  });

  it("does not import an old cached shell from another cache version", async () => {
    const sw = worker();
    sw.seed("calculadora-quimio-v1", "/index.html", publicShell("stale shell"));
    sw.fetch.mockRejectedValueOnce(new Error("offline"));
    await expect(sw.dispatch(request("/", { mode: "navigate" }))).rejects.toThrow("offline");
  });

  it("never returns cached HTML for a missing JavaScript asset offline", async () => {
    const sw = worker();
    sw.seed("calculadora-quimio-v1", "/index.html", publicShell("wrong HTML"));
    sw.fetch.mockRejectedValueOnce(new Error("offline"));
    await expect(
      sw.dispatch(request(scriptPath, { destination: "script" })),
    ).rejects.toThrow("offline");
    expect(sw.writes).toEqual([]);
  });

  it.each([
    [scriptPath, "text/javascript", "compiled JS"],
    [cssPath, "text/css", "compiled CSS"],
    ["/assets/logo-B9ShKi6O.svg", "image/svg+xml", "compiled image"],
    ["/assets/font-DO5F5pK8.woff2", "font/woff2", "compiled font"],
    ["/manifest.json", "application/manifest+json", "public manifest"],
    ["/favicon.ico", "image/x-icon", "public icon"],
    ["/icon-192.png", "image/png", "public icon"],
  ])("caches approved public resource %s with matching MIME", async (path, mime, body) => {
    const sw = worker();
    sw.fetch.mockResolvedValueOnce(response(body, mime));
    const online = await sw.dispatch(request(path));
    expect(await online.response.text()).toBe(body);
    expect(sw.writes).toEqual([`${origin}${path}`]);
    const offline = await sw.dispatch(request(path));
    expect(offline.intercepted).toBe(true);
    expect(await offline.response.text()).toBe(body);
    expect(sw.fetch).toHaveBeenCalledTimes(1);
    expect([...sw.stores.keys()]).toHaveLength(1);
    expect([...sw.stores.keys()][0]).toMatch(/^calculadora-quimio-/);
    expect(sw.stores.has("calculadora-quimio-v1")).toBe(false);
  });

  it("keeps different fingerprinted build versions separate", async () => {
    const sw = worker();
    sw.fetch.mockResolvedValueOnce(response("build one"));
    await sw.dispatch(request(scriptPath));
    sw.fetch.mockResolvedValueOnce(response("build two"));
    const result = await sw.dispatch(request("/assets/index-B9ShKi6O.js"));
    expect(await result.response.text()).toBe("build two");
    expect(sw.writes).toEqual([
      `${origin}${scriptPath}`,
      `${origin}/assets/index-B9ShKi6O.js`,
    ]);
  });

  it("rejects HTML returned by the server for a JS or CSS asset", async () => {
    const sw = worker();
    for (const path of [scriptPath, cssPath]) {
      sw.fetch.mockResolvedValueOnce(publicShell("SPA fallback"));
      await expect(sw.dispatch(request(path))).rejects.toThrow("Unexpected HTML");
      expect(sw.writes).toEqual([]);
      sw.fetch.mockRejectedValueOnce(new Error("offline"));
      await expect(sw.dispatch(request(path))).rejects.toThrow("offline");
    }
  });

  it("ignores even a MIME-poisoned asset in the current worker cache", async () => {
    const sw = worker();
    sw.fetch.mockResolvedValueOnce(response("good JS"));
    await sw.dispatch(request(scriptPath));
    const current = [...sw.stores.keys()][0];
    sw.seed(current, scriptPath, publicShell("poisoned HTML"));
    sw.fetch.mockRejectedValueOnce(new Error("offline"));
    await expect(sw.dispatch(request(scriptPath))).rejects.toThrow("offline");
  });

  it.each([
    { "Cache-Control": "private, max-age=3600" },
    { "Cache-Control": "no-store" },
    { "Cache-Control": "no-cache" },
    { "Set-Cookie": "session=secret" },
    { Vary: "Cookie" },
    { Vary: "Authorization" },
    { Vary: "*" },
  ])("does not persist a sensitive response with %j", async (headers) => {
    const sw = worker();
    sw.fetch.mockResolvedValueOnce(response("sensitive", "text/javascript", headers));
    await sw.dispatch(request(scriptPath));
    expect(sw.writes).toEqual([]);
  });

  it("does not cache a shell without an explicit public response directive", async () => {
    const sw = worker();
    sw.fetch.mockResolvedValueOnce(response("potential patient HTML", "text/html"));
    await sw.dispatch(request("/", { mode: "navigate" }));
    expect(sw.writes).toEqual([]);
  });

  it("does not cache patient-specific navigation or query data", async () => {
    const sw = worker();
    for (const path of ["/patients/42", "/?patient=42", "/index.html?token=secret"]) {
      sw.fetch.mockResolvedValueOnce(publicShell("patient HTML"));
      await sw.dispatch(request(path, { mode: "navigate" }));
    }
    expect(sw.writes).toEqual([]);
  });

  it.each(["opaque", "cors", "opaqueredirect"])(
    "does not cache %s responses",
    async (type) => {
      const sw = worker();
      sw.fetch.mockResolvedValueOnce(response("external", "text/javascript", {}, type));
      await sw.dispatch(request(scriptPath));
      expect(sw.writes).toEqual([]);
    },
  );

  it("does not cache redirect or unsuccessful static responses", async () => {
    const sw = worker();
    for (const status of [302, 404, 500]) {
      sw.fetch.mockResolvedValueOnce(response("error", "text/javascript", {}, "basic", status));
      await sw.dispatch(request(scriptPath));
    }
    const redirected = response("redirected");
    Object.defineProperty(redirected, "redirected", { value: true });
    sw.fetch.mockResolvedValueOnce(redirected);
    await sw.dispatch(request(scriptPath));
    expect(sw.writes).toEqual([]);
  });

  it.each([
    "http://localhost:3000/sw.js",
    "http://127.0.0.1:3000/sw.js",
    "http://[::1]:3000/sw.js",
    "https://app.localhost/sw.js",
    "https://3000-preview.manus.computer/sw.js",
    "https://manus.computer/sw.js",
  ])("does not precache or intercept HTML on development host %s", async (location) => {
    const sw = worker(location);
    await sw.lifecycle("install");
    expect(sw.writes).toEqual([]);
    expect(sw.fetch).not.toHaveBeenCalled();
    const result = await sw.dispatch(new Request(new URL("/", location)));
    expect(result.intercepted).toBe(false);
  });

  it("does not precache potentially authenticated HTML during production install", async () => {
    const sw = worker();
    await sw.lifecycle("install");
    expect(sw.writes).toEqual([]);
    expect(sw.fetch).not.toHaveBeenCalled();
  });

  it("activation removes only obsolete caches in the application's own prefix", async () => {
    const sw = worker();
    sw.fetch.mockResolvedValueOnce(response("current asset"));
    await sw.dispatch(request(scriptPath));
    const current = [...sw.stores.keys()][0];
    sw.seed("calculadora-quimio-v1", "/", publicShell("old"));
    sw.seed("calculadora-quimio-obsolete", "/", publicShell("old"));
    sw.seed("unrelated-pwa-v1", "/", publicShell("third-party shell"));
    sw.seed("calculadora-other-app-v1", "/", publicShell("unrelated shell"));
    await sw.lifecycle("activate");
    expect([...sw.stores.keys()].sort()).toEqual(
      [current, "unrelated-pwa-v1", "calculadora-other-app-v1"].sort(),
    );
  });

  it("unrelated cached assets cannot shadow the production worker's fetch", async () => {
    const sw = worker();
    sw.seed("another-app", scriptPath, response("third-party stale JS"));
    sw.fetch.mockResolvedValueOnce(response("fresh JS"));
    const result = await sw.dispatch(request(scriptPath));
    expect(await result.response.text()).toBe("fresh JS");
  });

  it("cache storage failure does not discard a successful network response", async () => {
    const sw = worker();
    sw.caches.open.mockRejectedValue(new Error("cache unavailable"));
    sw.fetch.mockResolvedValueOnce(response("fresh JS"));
    const result = await sw.dispatch(request(scriptPath));
    expect(await result.response.text()).toBe("fresh JS");
  });
});
