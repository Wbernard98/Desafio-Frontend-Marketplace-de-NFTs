import { isAxiosError } from "axios";
import type { ApiErrorBody, ApiErrorCode } from "./types";

export type ClientErrorCode = ApiErrorCode | "network" | "timeout" | "canceled" | "unknown";

export interface NormalizedError {
  status: number | null;
  code: ClientErrorCode;
  message: string;
  fields: Record<string, string>;
  details?: unknown;
  /** Falha transitória: vale tentar de novo (rede, timeout, 5xx). */
  transient: boolean;
}

/** Converte qualquer erro (Axios, domínio, desconhecido) em um formato único para a UI. */
export function toApiError(error: unknown): NormalizedError {
  if (isAxiosError(error)) {
    if (error.code === "ERR_CANCELED") return { status: null, code: "canceled", message: "Requisição cancelada.", fields: {}, transient: false };
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT")
      return { status: null, code: "timeout", message: "O servidor demorou demais para responder. Tente novamente.", fields: {}, transient: true };
    if (!error.response)
      return { status: null, code: "network", message: "Sem conexão com o servidor. Verifique sua internet e tente novamente.", fields: {}, transient: true };
    const body = error.response.data as Partial<ApiErrorBody> | undefined;
    const status = error.response.status;
    return {
      status,
      code: body?.code ?? (status >= 500 ? "internal_error" : "unknown"),
      message: body?.message ?? (status >= 500 ? "Erro no servidor. Tente novamente em instantes." : "Não foi possível concluir a operação."),
      fields: body?.fields ?? {},
      details: body?.details,
      transient: status >= 500,
    };
  }
  return { status: null, code: "unknown", message: "Algo deu errado. Tente novamente.", fields: {}, transient: false };
}

export const isCode = (error: unknown, ...codes: ClientErrorCode[]) => codes.includes(toApiError(error).code);
