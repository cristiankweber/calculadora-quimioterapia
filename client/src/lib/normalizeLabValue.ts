/**
 * Normaliza valores de laboratório que podem ter sido salvos multiplicados por 100
 * 
 * Lógica:
 * - Valores > 20: assume que foram salvos como inteiros (multiplicados por 100) e divide por 100
 * - Valores ≤ 20: assume que já estão no formato decimal correto
 * 
 * Exemplos:
 * - 97 → 0.97 (creatinina legada)
 * - 120 → 1.20 (creatinina legada)
 * - 1.2 → 1.2 (creatinina nova, não afetada)
 * - 0.8 → 0.8 (bilirrubina nova, não afetada)
 * 
 * @param value - Valor bruto do banco de dados
 * @returns Valor normalizado no formato decimal
 */
export function normalizeLabValue(value: number | null | undefined): number {
  if (value == null || value === 0) {
    return 0;
  }

  // Se o valor for maior que 20, assume que foi salvo multiplicado por 100
  // (creatinina normal: 0.5-1.5 mg/dL, bilirrubina normal: 0.3-1.2 mg/dL)
  if (value > 20) {
    return Number((value / 100).toFixed(2));
  }

  // Valor já está no formato correto
  return Number(value.toFixed(2));
}
