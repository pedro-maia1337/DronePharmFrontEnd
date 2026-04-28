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

function isIsoDateTime(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

export const pedidoSchema = z.object({
  farmacia_id: z
    .coerce.number({
      error: "A farmácia de origem deve ser um número válido.",
    })
    .int("A farmácia de origem deve ser um número inteiro.")
    .positive("Selecione uma farmácia de origem válida."),
  latitude: z
    .coerce.number({
      error: "A latitude deve ser um número válido.",
    })
    .min(LATITUDE_MIN, "A latitude deve estar entre -90 e 90.")
    .max(LATITUDE_MAX, "A latitude deve estar entre -90 e 90."),
  longitude: z
    .coerce.number({
      error: "A longitude deve ser um número válido.",
    })
    .min(LONGITUDE_MIN, "A longitude deve estar entre -180 e 180.")
    .max(LONGITUDE_MAX, "A longitude deve estar entre -180 e 180."),
  peso_kg: z
    .coerce.number({
      error: "O peso deve ser um número válido.",
    })
    .positive("O peso deve ser maior que zero.")
    .max(
      PEDIDO_PESO_MAXIMO_KG,
      "O peso do pedido nao pode ultrapassar 2 kg."
    ),
  prioridade: z.coerce.number().pipe(
    z.union(
    [
      z.literal(PRIORIDADE_URGENTE),
      z.literal(PRIORIDADE_NORMAL),
      z.literal(PRIORIDADE_REABASTECIMENTO),
    ],
    {
      error: "A prioridade deve ser 1, 2 ou 3.",
    }
  )),
  descricao: z
    .string()
    .trim()
    .max(
      DESCRICAO_MAX_LENGTH,
      "A descricao deve ter no maximo 300 caracteres."
    )
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

export type PedidoFormInput = z.input<typeof pedidoSchema>;
export type PedidoFormData = z.output<typeof pedidoSchema>;
