import { z } from "zod";

const NOME_MIN_LENGTH = 3;
const NOME_MAX_LENGTH = 120;
const ENDERECO_MIN_LENGTH = 5;
const ENDERECO_MAX_LENGTH = 300;
const CIDADE_MIN_LENGTH = 2;
const CIDADE_MAX_LENGTH = 100;
const UF_LENGTH = 2;
const CNPJ_LENGTH = 14;
const LATITUDE_MIN = -90;
const LATITUDE_MAX = 90;
const LONGITUDE_MIN = -180;
const LONGITUDE_MAX = 180;

export const farmaciaSchema = z.object({
  cnpj: z
    .string()
    .trim()
    .transform((value) => value.replace(/\D/g, ""))
    .refine((value) => new RegExp(`^\\d{${CNPJ_LENGTH}}$`).test(value), {
      message: "O CNPJ deve conter exatamente 14 digitos numericos.",
    }),
  nome: z
    .string()
    .trim()
    .min(NOME_MIN_LENGTH, "O nome da farmacia deve ter pelo menos 3 caracteres.")
    .max(NOME_MAX_LENGTH, "O nome da farmacia deve ter no maximo 120 caracteres."),
  endereco: z
    .string()
    .trim()
    .min(ENDERECO_MIN_LENGTH, "O endereco deve ter pelo menos 5 caracteres.")
    .max(ENDERECO_MAX_LENGTH, "O endereco deve ter no maximo 300 caracteres."),
  cidade: z
    .string()
    .trim()
    .min(CIDADE_MIN_LENGTH, "A cidade deve ter pelo menos 2 caracteres.")
    .max(CIDADE_MAX_LENGTH, "A cidade deve ter no maximo 100 caracteres."),
  uf: z
    .string()
    .trim()
    .length(UF_LENGTH, "A UF deve ter exatamente 2 caracteres.")
    .transform((value) => value.toUpperCase()),
  latitude: z
    .number({
      error: "A latitude deve ser um numero valido.",
    })
    .min(LATITUDE_MIN, "A latitude deve estar entre -90 e 90.")
    .max(LATITUDE_MAX, "A latitude deve estar entre -90 e 90."),
  longitude: z
    .number({
      error: "A longitude deve ser um numero valido.",
    })
    .min(LONGITUDE_MIN, "A longitude deve estar entre -180 e 180.")
    .max(LONGITUDE_MAX, "A longitude deve estar entre -180 e 180."),
  deposito: z.boolean({
    error: "Informe se a farmacia e um deposito.",
  }),
  ativa: z.boolean({
    error: "Informe se a farmacia esta ativa.",
  }),
});

export type FarmaciaFormData = z.infer<typeof farmaciaSchema>;
