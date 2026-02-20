/**
 * Utilitários numéricos seguros para cálculos clínicos.
 *
 * Todas as funções garantem que o resultado nunca será NaN, Infinity ou negativo,
 * retornando 0 quando a entrada for inválida.
 */

/** Verifica se um valor é um número finito positivo (> 0). */
export function isPositiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/** Verifica se um valor é um número finito não-negativo (>= 0). */
export function isNonNegativeFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/**
 * Arredonda para N casas decimais de forma segura.
 * Retorna 0 se o valor for NaN ou Infinity.
 */
export function safeRound(value: number, decimals: number = 1): number {
  if (!Number.isFinite(value)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Limita um valor entre min e max (clamp).
 * Retorna min se o valor for NaN ou Infinity.
 */
export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

/**
 * Converte entrada para número seguro.
 * Retorna fallback se a conversão falhar ou gerar NaN/Infinity/negativo.
 */
export function toSafeNumber(input: unknown, fallback: number = 0): number {
  if (typeof input === 'number') {
    return Number.isFinite(input) ? input : fallback;
  }
  if (typeof input === 'string') {
    const parsed = parseFloat(input);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}
