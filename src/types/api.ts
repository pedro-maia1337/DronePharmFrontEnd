export type PedidoStatus =
  | "pendente"
  | "calculado"
  | "despachado"
  | "em_voo"
  | "entregue"
  | "cancelado"
  | "falha";

export type PrioridadeEnum = 1 | 2 | 3;
export type StatusDroneEnum =
  | "aguardando"
  | "em_voo"
  | "retornando"
  | "carregando"
  | "manutencao"
  | "emergencia";

export interface ValidationErrorDetail {
  loc: Array<string | number>;
  msg: string;
  type: string;
}

export interface HTTPValidationError {
  detail?: ValidationErrorDetail[];
}

export interface CoordenadaSchema {
  latitude: number;
  longitude: number;
}

export interface PedidoCreate {
  coordenada: CoordenadaSchema;
  peso_kg: number;
  prioridade?: PrioridadeEnum;
  descricao?: string;
  farmacia_id: number;
  janela_fim?: string | null;
}

export interface PedidoUpdate {
  descricao?: string | null;
  janela_fim?: string | null;
}

export interface PedidoResponse {
  id: number;
  latitude: number;
  longitude: number;
  peso_kg: number;
  prioridade: PrioridadeEnum;
  descricao: string | null;
  farmacia_id: number;
  rota_id: number | null;
  status: PedidoStatus;
  janela_fim: string | null;
  criado_em: string;
  entregue_em: string | null;
  despachado_em?: string | null;
  estimativa_entrega_em?: string | null;
  coordenada: CoordenadaSchema;
}

export interface PedidoListResponse {
  total: number;
  pedidos: PedidoResponse[];
  total_count?: number;
  limit?: number;
  offset?: number;
  has_more?: boolean;
}

export interface PosicaoAtualResponse {
  latitude?: number | null;
  longitude?: number | null;
  altitude_m?: number | null;
  atualizado_em?: string | null;
}

export interface DestinoPedidoResponse {
  latitude: number;
  longitude: number;
}

export interface PedidoResumoTrackingResponse {
  prioridade: PrioridadeEnum;
  descricao?: string | null;
  farmacia_id: number;
  janela_fim?: string | null;
}

export interface WaypointResponse {
  seq: number;
  latitude: number;
  longitude: number;
  altitude: number;
  label: string;
}

export interface DroneCreate {
  id: string;
  nome: string;
  capacidade_max_kg?: number;
  autonomia_max_km?: number;
  velocidade_ms?: number;
}

export interface DroneUpdate {
  status?: StatusDroneEnum | null;
  bateria_pct?: number | null;
  latitude_atual?: number | null;
  longitude_atual?: number | null;
}

export interface DroneResponse {
  id: string;
  nome: string;
  capacidade_max_kg: number;
  autonomia_max_km: number;
  velocidade_ms: number;
  status: StatusDroneEnum;
  bateria_pct: number;
  latitude_atual: number | null;
  longitude_atual: number | null;
  missoes_realizadas: number;
  cadastrado_em: string;
}

export interface DroneListResponse {
  total: number;
  drones: DroneResponse[];
}

export interface FarmaciaCreate {
  nome: string;
  latitude: number;
  longitude: number;
  endereco?: string;
  cidade?: string;
  uf?: string;
  deposito?: boolean;
}

export interface FarmaciaUpdate {
  nome?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  uf?: string | null;
  ativa?: boolean | null;
  deposito?: boolean | null;
}

export interface FarmaciaResponse {
  id: number;
  nome: string;
  latitude: number;
  longitude: number;
  endereco: string;
  cidade: string;
  uf: string;
  deposito: boolean;
  ativa: boolean;
  criada_em?: string | null;
}

export interface FarmaciaListResponse {
  total: number;
  farmacias: FarmaciaResponse[];
}

export interface RotaResponse {
  id: number;
  drone_id: string;
  pedido_ids: number[];
  waypoints: WaypointResponse[];
  distancia_km: number;
  tempo_min: number;
  energia_wh: number;
  carga_kg: number;
  custo: number;
  viavel: boolean;
  geracoes_ga: number;
  status: string;
  criada_em: string;
  concluida_em?: string | null;
}

export interface PedidoAtivoResponse {
  pedido_id: number;
  rota_id?: number | null;
  drone_id?: string | null;
  status: PedidoStatus;
  rota?: RotaResponse | null;
  drone?: DroneResponse | null;
  eta_segundos?: number | null;
  estimativa_entrega_em?: string | null;
  tempo_decorrido_seg?: number | null;
  tempo_restante_seg?: number | null;
  posicao_atual: PosicaoAtualResponse;
  destino: DestinoPedidoResponse;
  pedido: PedidoResumoTrackingResponse;
}

export interface TelemetriaResponse {
  id: number;
  drone_id: string;
  latitude: number;
  longitude: number;
  altitude_m: number;
  velocidade_ms: number;
  bateria_pct: number;
  vento_ms: number;
  direcao_vento: number;
  status: string;
  criado_em: string;
}

export type WSTelemetriaPayload = TelemetriaResponse;
