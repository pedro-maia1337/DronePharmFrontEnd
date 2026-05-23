import { z } from "zod";

const PRIORIDADE_URGENTE = 1;
const PRIORIDADE_NORMAL = 2;
const PRIORIDADE_REABASTECIMENTO = 3;
const PEDIDO_PESO_MAXIMO_KG = 2;
const DESCRICAO_MAX_LENGTH = 300;
const LATITUDE_MIN = -90;
const LATITUDE_MAX = 90;
const LONGITUDE_MIN = -180;
const LONGITUDE_MAX = 180;
const COORDINATE_DECIMAL_PLACES = 6;
const COORDINATE_DECIMAL_FACTOR = 10 ** COORDINATE_DECIMAL_PLACES;
const FLOATING_POINT_TOLERANCE = 1e-8;

function isIsoDateTime(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function hasAtMostCoordinateDecimalPlaces(value: number): boolean {
  const scaledValue = value * COORDINATE_DECIMAL_FACTOR;

  return Math.abs(scaledValue - Math.round(scaledValue)) < FLOATING_POINT_TOLERANCE;
}

export const pedidoItemSchema = z.object({
  farmacia_id: z
    .coerce.number({
      error: "A farmacia de origem deve ser um numero valido.",
    })
    .int("A farmacia de origem deve ser um numero inteiro.")
    .positive("Selecione uma farmacia de origem valida."),
  latitude: z
    .coerce.number({
      error: "A latitude deve ser um numero valido.",
    })
    .min(LATITUDE_MIN, "A latitude deve estar entre -90 e 90.")
    .max(LATITUDE_MAX, "A latitude deve estar entre -90 e 90.")
    .refine(hasAtMostCoordinateDecimalPlaces, {
      message: "A latitude deve ter no maximo 6 casas decimais.",
    }),
  longitude: z
    .coerce.number({
      error: "A longitude deve ser um numero valido.",
    })
    .min(LONGITUDE_MIN, "A longitude deve estar entre -180 e 180.")
    .max(LONGITUDE_MAX, "A longitude deve estar entre -180 e 180.")
    .refine(hasAtMostCoordinateDecimalPlaces, {
      message: "A longitude deve ter no maximo 6 casas decimais.",
    }),
  peso_kg: z
    .coerce.number({
      error: "O peso deve ser um numero valido.",
    })
    .positive("O peso deve ser maior que zero.")
    .max(PEDIDO_PESO_MAXIMO_KG, "O peso do pedido nao pode ultrapassar 2 kg."),
  prioridade: z.coerce.number().pipe(
    z.union(
      [
        z.literal(PRIORIDADE_URGENTE),
        z.literal(PRIORIDADE_NORMAL),
        z.literal(PRIORIDADE_REABASTECIMENTO),
      ],
      {
        error: "A prioridade deve ser 1, 2 ou 3.",
      },
    ),
  ),
  descricao: z
    .string()
    .trim()
    .max(DESCRICAO_MAX_LENGTH, "A descricao deve ter no maximo 300 caracteres.")
    .optional(),
  janela_fim: z
    .string()
    .trim()
    .refine(isIsoDateTime, {
      message: "A janela final deve estar em formato ISO 8601 valido.",
    })
    .optional()
    .or(z.literal("")),
});

export const pedidoSchema = z.object({
  pedidos: z
    .array(pedidoItemSchema)
    .min(1, "Adicione pelo menos um pedido para envio."),
});

export type PedidoFormItemInput = z.input<typeof pedidoItemSchema>;
export type PedidoFormItemData = z.output<typeof pedidoItemSchema>;
export type PedidoFormInput = z.input<typeof pedidoSchema>;
export type PedidoFormData = z.output<typeof pedidoSchema>;
