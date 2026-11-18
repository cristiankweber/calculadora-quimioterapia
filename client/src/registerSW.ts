export function registerServiceWorker() {
  if (import.meta.env.DEV || !("serviceWorker" in navigator)) return;
  const register = () => {
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then(registration =>
        console.log("[SW] Service Worker registrado:", registration.scope)
      )
      .catch(error =>
        console.warn("[SW] Registro do Service Worker indisponível:", error)
      );
  };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
