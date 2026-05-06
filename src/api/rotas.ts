import { apiFetch } from "./client";
import type {
  RotaResponse,
  RoteirizarRequest,
  RoteirizarResponse,
} from "../types/api";

const ROTAS_BASE_PATH = "/api/v1/rotas";

export function calcularRotas(
  body: RoteirizarRequest,
): Promise<RoteirizarResponse> {
  return apiFetch<RoteirizarResponse>(`${ROTAS_BASE_PATH}/calcular`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export function getRota(rotaId: number): Promise<RotaResponse> {
  return apiFetch<RotaResponse>(`${ROTAS_BASE_PATH}/${rotaId}`);
}

export function despacharRota(rotaId: number): Promise<void> {
  return apiFetch<void>(`${ROTAS_BASE_PATH}/${rotaId}/despachar`, {
    method: "POST",
  });
}

export function simularRotaAgora(rotaId: number): Promise<void> {
  return apiFetch<void>(`${ROTAS_BASE_PATH}/${rotaId}/simular-agora`, {
    method: "POST",
  });
}

export function abortarRota(rotaId: number, motivo = "Abortada pelo operador"): Promise<void> {
  return apiFetch<void>(`${ROTAS_BASE_PATH}/${rotaId}/abortar`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ motivo }),
  });
}
