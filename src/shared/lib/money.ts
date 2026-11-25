import Decimal from "decimal.js";

/** ETH trafega como string decimal; nunca usar number em cálculos de valor. */
export type EthString = string;

export const fmtEth = (v: EthString) => `${new Decimal(v).toFixed(2)} ETH`;
export const sumEth = (values: EthString[]): EthString =>
  values.reduce((a, b) => a.plus(b), new Decimal(0)).toString();

/** Formata ETH com precisão fixa (sem perder precisão: usa Decimal). */
export const fmtEthDp = (v: EthString, dp: number) => `${new Decimal(v).toFixed(dp)} ETH`;
