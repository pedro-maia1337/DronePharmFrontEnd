import { apiFetch } from "./client";
import type {
  DroneCreate,
  DroneListResponse,
  DroneResponse,
  DroneUpdate,
} from "../types/api";

const DRONES_BASE_PATH = "/api/v1/drones";

export function listDrones(): Promise<DroneListResponse> {
  return apiFetch<DroneListResponse>(`${DRONES_BASE_PATH}/`);
}

export function getDrone(id: string): Promise<DroneResponse> {
  return apiFetch<DroneResponse>(`${DRONES_BASE_PATH}/${id}`);
}

export function criarDrone(body: DroneCreate): Promise<DroneResponse> {
  return apiFetch<DroneResponse>(`${DRONES_BASE_PATH}/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export function atualizarDrone(
  id: string,
  body: DroneUpdate
): Promise<DroneResponse> {
  return apiFetch<DroneResponse>(`${DRONES_BASE_PATH}/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
