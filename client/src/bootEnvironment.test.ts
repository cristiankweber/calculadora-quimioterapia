import { afterEach, describe, expect, it, vi } from "vitest";
import {
  prepareDevelopmentEnvironment,
  startApplication,
} from "./bootEnvironment";
import { registerServiceWorker } from "./registerSW";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
function environment(controller = true) {
  const own = {
    active: { scriptURL: "https://preview.test/sw.js" },
    waiting: null,
    installing: null,
    unregister: vi.fn(async () => true),
  };
  const other = {
    active: { scriptURL: "https://preview.test/other/sw.js" },
    waiting: null,
    installing: null,
    unregister: vi.fn(async () => true),
  };
  const deleted: string[] = [];
  const sw = {
    controller: controller ? { scriptURL: "https://preview.test/sw.js" } : null,
    getRegistrations: vi.fn(async () => [own, other]),
    register: vi.fn(async () => ({ scope: "/" })),
  };
  vi.stubGlobal("navigator", { serviceWorker: sw });
  vi.stubGlobal("window", {
    location: { origin: "https://preview.test" },
    addEventListener: (name: string, callback: () => void) => {
      if (name === "load") callback();
    },
  });
  vi.stubGlobal("caches", {
    keys: async () => [
      "calculadora-quimio-v1",
      "calculadora-quimio-old",
      "another-app-cache",
    ],
    delete: async (key: string) => {
      deleted.push(key);
      return true;
    },
  });
  return { own, other, deleted, sw };
}
describe("bootstrap da prévia sem duplicação de React", () => {
  it("espera a limpeza de cache antes de importar a aplicação", async () => {
    vi.stubEnv("DEV", true);
    const env = environment(false);
    let release!: (value: any[]) => void;
    env.sw.getRegistrations.mockImplementation(
      () =>
        new Promise(resolve => {
          release = resolve;
        })
    );
    const load = vi.fn(async () => {});
    const boot = startApplication(load);
    await Promise.resolve();
    expect(load).not.toHaveBeenCalled();
    release([]);
    await boot;
    expect(load).toHaveBeenCalledOnce();
  });
  it("controlador antigo exige um reload antes do React, sem carregar grafo misturado", async () => {
    vi.stubEnv("DEV", true);
    environment();
    const reload = vi.fn();
    vi.stubGlobal("window", {
      location: { origin: "https://preview.test", reload },
    });
    const load = vi.fn(async () => {});
    await startApplication(load);
    expect(reload).toHaveBeenCalledOnce();
    expect(load).not.toHaveBeenCalled();
  });
  it("remove só caches e SW próprios e pede navegação limpa antes do React quando o controlador antigo continua ativo", async () => {
    vi.stubEnv("DEV", true);
    const env = environment();
    expect(await prepareDevelopmentEnvironment()).toBe(true);
    expect(env.own.unregister).toHaveBeenCalledOnce();
    expect(env.other.unregister).not.toHaveBeenCalled();
    expect(env.deleted).toEqual([
      "calculadora-quimio-v1",
      "calculadora-quimio-old",
    ]);
  });
  it("sem controlador antigo conclui a limpeza sem pedir reload", async () => {
    vi.stubEnv("DEV", true);
    const env = environment(false);
    expect(await prepareDevelopmentEnvironment()).toBe(false);
    expect(env.deleted).toHaveLength(2);
  });
  it("recusa de unregister não causa reload infinito mesmo se o cache for removido", async () => {
    vi.stubEnv("DEV", true);
    const env = environment();
    env.own.unregister.mockResolvedValue(false);
    expect(await prepareDevelopmentEnvironment()).toBe(false);
    expect(env.deleted).toHaveLength(2);
  });
  it("produção não desregistra nem apaga caches de funcionamento offline", async () => {
    vi.stubEnv("DEV", false);
    const env = environment();
    expect(await prepareDevelopmentEnvironment()).toBe(false);
    expect(env.sw.getRegistrations).not.toHaveBeenCalled();
    expect(env.deleted).toEqual([]);
  });
  it("cache não disponível e navegador sem SW não impedem o carregamento", async () => {
    vi.stubEnv("DEV", true);
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("window", { location: { origin: "https://preview.test" } });
    vi.stubGlobal("caches", undefined);
    expect(await prepareDevelopmentEnvironment()).toBe(false);
  });
  it("falha isolada de storage não gera rejeição não tratada", async () => {
    vi.stubEnv("DEV", true);
    environment(false);
    vi.stubGlobal("caches", {
      keys: async () => {
        throw new Error("storage denied");
      },
    });
    await expect(prepareDevelopmentEnvironment()).resolves.toBe(false);
  });
  it("desenvolvimento não registra novamente o SW depois de remover o antigo", () => {
    vi.stubEnv("DEV", true);
    const env = environment();
    registerServiceWorker();
    expect(env.sw.register).not.toHaveBeenCalled();
  });
  it("produção registra sem cache HTTP do script de SW mesmo após o evento load", async () => {
    vi.stubEnv("DEV", false);
    const env = environment();
    vi.stubGlobal("document", { readyState: "complete" });
    registerServiceWorker();
    await Promise.resolve();
    expect(env.sw.register).toHaveBeenCalledWith("/sw.js", {
      updateViaCache: "none",
    });
  });
});
