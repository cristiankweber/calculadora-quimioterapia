/**
 * Configuração de ambiente com fail-fast.
 *
 * Variáveis CRÍTICAS (servidor não inicia sem elas):
 * - DATABASE_URL, JWT_SECRET, OAUTH_SERVER_URL
 *
 * Variáveis OPCIONAIS (funcionalidade degradada sem elas):
 * - VITE_APP_ID, OWNER_OPEN_ID, BUILT_IN_FORGE_API_URL, BUILT_IN_FORGE_API_KEY
 */

// ─── Helpers ────────────────────────────────────────────────────────────────

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === "") {
    // Em modo de teste, não bloquear
    if (process.env.NODE_ENV === "test" || process.env.VITEST) {
      return "";
    }
    console.error(
      `[ENV] FATAL: Variável de ambiente obrigatória "${key}" não definida. O servidor não pode iniciar.`
    );
    process.exit(1);
  }
  return value.trim();
}

function optionalEnv(key: string, fallback = ""): string {
  const value = process.env[key];
  if (!value || value.trim() === "") {
    if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
      console.warn(
        `[ENV] WARN: Variável de ambiente opcional "${key}" não definida. Usando fallback.`
      );
    }
    return fallback;
  }
  return value.trim();
}

// ─── Exportação ─────────────────────────────────────────────────────────────

export const ENV = {
  // Críticas (fail-fast)
  databaseUrl: requireEnv("DATABASE_URL"),
  cookieSecret: requireEnv("JWT_SECRET"),
  oAuthServerUrl: requireEnv("OAUTH_SERVER_URL"),

  // Opcionais (funcionalidade degradada)
  appId: optionalEnv("VITE_APP_ID"),
  ownerOpenId: optionalEnv("OWNER_OPEN_ID"),
  forgeApiUrl: optionalEnv("BUILT_IN_FORGE_API_URL"),
  forgeApiKey: optionalEnv("BUILT_IN_FORGE_API_KEY"),

  // Derivadas
  isProduction: process.env.NODE_ENV === "production",
  isTest: process.env.NODE_ENV === "test" || !!process.env.VITEST,
};
