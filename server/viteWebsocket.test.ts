import { createServer } from "node:http";
import express from "express";
import { describe, it, expect, vi } from "vitest";
import { setupVite } from "./_core/vite";
import { createServer as createViteServer, type InlineConfig } from "vite";
import viteConfig from "../vite.config";
vi.mock("vite", async importOriginal => {
  const original = await importOriginal<typeof import("vite")>();
  return {
    ...original,
    createServer: vi.fn(async () => ({
      middlewares: (_req: unknown, _res: unknown, next: () => void) => next(),
      transformIndexHtml: async (_url: string, html: string) => html,
      ssrFixStacktrace: () => {},
    })),
  };
});
describe("Integração Vite/Express usa WebSocket na origem da aplicação", () => {
  it("liga HMR ao mesmo servidor HTTP em vez de usar a porta interna 24678", async () => {
    const server = createServer();
    const app = express();
    await setupVite(app, server);
    const options = vi
      .mocked(createViteServer)
      .mock.calls.at(-1)![0] as InlineConfig;
    expect(options.server?.middlewareMode).toBe(true);
    const hmr = options.server?.hmr;
    expect(hmr).toBeTypeOf("object");
    if (typeof hmr !== "object" || !hmr)
      throw Error("HMR sem servidor compartilhado");
    expect(hmr.server).toBe(server);
    expect(hmr.port).toBeUndefined();
    expect(hmr.clientPort).toBeUndefined();
    expect(hmr.host).toBeUndefined();
    expect(hmr.protocol).toBeUndefined();
  });
  it("preserva restrições de filesystem e demais opções da configuração original", async () => {
    await setupVite(express(), createServer());
    const options = vi
      .mocked(createViteServer)
      .mock.calls.at(-1)![0] as InlineConfig;
    expect(options.server?.fs).toEqual(viteConfig.server?.fs);
    expect(options.server?.host).toBe(viteConfig.server?.host);
    expect(options.server?.allowedHosts).toBe(true);
    expect(options.configFile).toBe(false);
  });
});
