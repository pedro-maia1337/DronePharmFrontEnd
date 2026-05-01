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
