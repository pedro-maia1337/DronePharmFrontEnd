import { z } from "zod";

const NOME_MIN_LENGTH = 3;
const NOME_MAX_LENGTH = 120;
const CIDADE_MIN_LENGTH = 2;
const CIDADE_MAX_LENGTH = 80;
const TELEFONE_MAX_LENGTH = 20;
const LATITUDE_MIN = -90;
const LATITUDE_MAX = 90;
const LONGITUDE_MIN = -180;
const LONGITUDE_MAX = 180;

export const farmaciaSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(
      NOME_MIN_LENGTH,
      "O nome da farmácia deve ter pelo menos 3 caracteres."
    )
    .max(
      NOME_MAX_LENGTH,
      "O nome da farmácia deve ter no máximo 120 caracteres."
    ),
  cidade: z
    .string()
    .trim()
    .min(CIDADE_MIN_LENGTH, "A cidade deve ter pelo menos 2 caracteres.")
    .max(CIDADE_MAX_LENGTH, "A cidade deve ter no máximo 80 caracteres."),
  latitude: z
    .number({
      error: "A latitude deve ser um número válido.",
    })
    .min(LATITUDE_MIN, "A latitude deve estar entre -90 e 90.")
    .max(LATITUDE_MAX, "A latitude deve estar entre -90 e 90."),
  longitude: z
    .number({
      error: "A longitude deve ser um número válido.",
    })
    .min(LONGITUDE_MIN, "A longitude deve estar entre -180 e 180.")
    .max(LONGITUDE_MAX, "A longitude deve estar entre -180 e 180."),
  telefone: z
    .string()
    .trim()
    .max(
      TELEFONE_MAX_LENGTH,
      "O telefone deve ter no máximo 20 caracteres."
    )
    .optional(),
  ativa: z.boolean({
    error: "Informe se a farmácia está ativa.",
  }),
});

export type FarmaciaFormData = z.infer<typeof farmaciaSchema>;
