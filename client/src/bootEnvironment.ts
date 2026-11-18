const APP_CACHE_PREFIX = "calculadora-quimio-";

/** No React imports: this runs before the application/dependency module graph is loaded. */
export async function prepareDevelopmentEnvironment(): Promise<boolean> {
  if (!import.meta.env.DEV) return false;
  const origin = window.location.origin;
  const ownScript = (scriptURL: string | undefined): boolean => {
    if (!scriptURL) return false;
    try {
      const url = new URL(scriptURL, origin);
      return url.origin === origin && url.pathname === "/sw.js";
    } catch {
      return false;
    }
  };
  let ownController = false;
  let unregistered = false;
  if ("serviceWorker" in navigator) {
    const sw = navigator.serviceWorker;
    ownController = ownScript(sw.controller?.scriptURL);
    try {
      const registrations = await sw.getRegistrations();
      for (const registration of registrations) {
        if (
          [
            registration.active,
            registration.waiting,
            registration.installing,
          ].some(worker => ownScript(worker?.scriptURL))
        ) {
          try {
            unregistered = (await registration.unregister()) || unregistered;
          } catch (error) {
            console.warn(
              "[SW] Não foi possível remover o cache worker antigo da prévia.",
              error
            );
          }
        }
      }
    } catch (error) {
      console.warn("[SW] Consulta de workers indisponível na prévia.", error);
    }
  }
  if (typeof caches !== "undefined") {
    try {
      const names = await caches.keys();
      for (const name of names.filter(value =>
        value.startsWith(APP_CACHE_PREFIX)
      )) {
        try {
          await caches.delete(name);
        } catch (error) {
          console.warn("[SW] Cache da prévia não pôde ser removido.", error);
        }
      }
    } catch (error) {
      console.warn("[SW] Storage de cache indisponível na prévia.", error);
    }
  }
  // Unregister does not detach a controller from the currently loaded document.
  // Navigate once, before React loads, to avoid repopulating stale dependency chunks.
  return ownController && unregistered;
}

export async function startApplication(
  loadApplication: () => Promise<unknown>
): Promise<void> {
  if (await prepareDevelopmentEnvironment()) {
    window.location.reload();
    return;
  }
  await loadApplication();
}
