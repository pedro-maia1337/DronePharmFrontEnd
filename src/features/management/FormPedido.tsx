import { useEffect, useMemo, type ReactElement } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useForm, type FieldError } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";

import { listFarmacias } from "@/api/farmacias";
import { criarPedido } from "@/api/pedidos";
import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/ui/FormInput";
import { FormSelect } from "@/components/ui/FormSelect";
import { FormSkeleton } from "@/components/ui/FormSkeleton";
import { RadioGroup } from "@/components/ui/RadioGroup";
import type { HTTPValidationError, PedidoCreate } from "@/types/api";

import {
  pedidoSchema,
  type PedidoFormInput,
  type PedidoFormData,
} from "./pedidoSchema";
import { useFarmaciasStore } from "../farmacias/store/useFarmaciasStore";
import { usePedidosStore } from "./store/usePedidosStore";

const PAGE_CLASS_NAME = "min-h-[calc(100dvh-56px)] bg-[var(--surface-base)]";
const TOPBAR_CLASS_NAME =
  "border-b border-[var(--surface-border)] bg-[var(--surface-panel)]";
const TOPBAR_CONTENT_CLASS_NAME =
  "mx-auto flex h-14 w-full max-w-[760px] items-center justify-between gap-4 px-6";
const BREADCRUMB_CLASS_NAME = "flex items-center gap-2 text-sm";
const BREADCRUMB_LINK_CLASS_NAME =
  "text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]";
const BREADCRUMB_CURRENT_CLASS_NAME = "text-[var(--text-primary)]";
const ACTIONS_CLASS_NAME = "flex items-center gap-2";
const CONTENT_CLASS_NAME =
  "mx-auto flex w-full max-w-[760px] flex-col gap-6 px-6 py-8";
const TITLE_CLASS_NAME = "text-xl font-semibold text-[var(--text-primary)]";
const DESCRIPTION_CLASS_NAME = "text-sm text-[var(--text-secondary)]";
const CARD_CLASS_NAME =
  "rounded-[var(--radius-lg)] border border-[var(--surface-border)] bg-[var(--surface-card)] p-7";
const CARD_TITLE_CLASS_NAME =
  "mb-4 text-sm font-medium uppercase tracking-[0.07em] text-[var(--text-secondary)]";
const GRID_TWO_COLUMNS_CLASS_NAME = "grid gap-4 md:grid-cols-2";
const DIVIDER_CLASS_NAME = "my-6 border-t border-[var(--surface-border)]";
const ROOT_ERROR_CLASS_NAME =
  "mb-4 rounded-[var(--radius-md)] border border-[var(--status-danger)] bg-[var(--status-danger-bg)] px-4 py-3 text-sm text-[var(--status-danger)]";
const FOOTER_ACTIONS_CLASS_NAME = "flex items-center justify-end gap-3";
const QUERY_STALE_TIME = 30_000;
const PEDIDOS_ROUTE_PATH = "/pedidos";
const DECIMAL_COORDINATE_HINT =
  "Use coordenadas decimais WGS84 com ate quatro casas decimais.";
const DELIVERY_WINDOW_HINT =
  "Se nao for informada, a janela final sera calculada automaticamente pela prioridade.";
const LOAD_ERROR_MESSAGE = "Nao foi possivel carregar as farmacias.";
const SAVE_ERROR_MESSAGE = "Nao foi possivel salvar o pedido.";

type PedidoFieldName = keyof PedidoFormData;

const PEDIDO_FIELD_NAMES: PedidoFieldName[] = [
  "farmacia_id",
  "latitude",
  "longitude",
  "peso_kg",
  "prioridade",
  "descricao",
  "janela_fim",
];

function isValidationError(error: unknown): error is HTTPValidationError {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  return "detail" in error;
}

function getErrorMessage(error: unknown): string {
  if (isValidationError(error)) {
    return error.detail?.[0]?.msg ?? SAVE_ERROR_MESSAGE;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return SAVE_ERROR_MESSAGE;
}

function getFieldError(error: unknown): FieldError | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  if (!("message" in error)) {
    return undefined;
  }

  return error as FieldError;
}

function getFieldNameFromLocation(
  location: Array<string | number> | undefined
): PedidoFieldName | null {
  if (location === undefined) {
    return null;
  }

  const locationPath = location
    .filter((item): item is string => typeof item === "string")
    .join(".");

  if (locationPath.endsWith("coordenada.latitude")) {
    return "latitude";
  }

  if (locationPath.endsWith("coordenada.longitude")) {
    return "longitude";
  }

  for (let index = location.length - 1; index >= 0; index -= 1) {
    const part = location[index];

    if (
      typeof part === "string" &&
      PEDIDO_FIELD_NAMES.includes(part as PedidoFieldName)
    ) {
      return part as PedidoFieldName;
    }
  }

  return null;
}

function buildPedidoPayload(data: PedidoFormData): PedidoCreate {
  const descricao = data.descricao?.trim();
  const janelaFim = data.janela_fim?.trim();

  return {
    coordenada: {
      latitude: data.latitude,
      longitude: data.longitude,
    },
    peso_kg: data.peso_kg,
    prioridade: data.prioridade,
    descricao: descricao === undefined || descricao.length === 0 ? undefined : descricao,
    farmacia_id: data.farmacia_id,
    janela_fim:
      janelaFim === undefined || janelaFim.length === 0
        ? undefined
        : new Date(janelaFim).toISOString(),
  };
}

function renderQueryError(message: string): ReactElement {
  return (
    <section className={PAGE_CLASS_NAME}>
      <div className={CONTENT_CLASS_NAME}>
        <div className="rounded-[var(--radius-lg)] border border-[var(--status-danger)] bg-[var(--surface-card)] p-6">
          <h1 className="mb-2 text-lg font-semibold text-[var(--text-primary)]">
            Falha ao carregar farmacias
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">{message}</p>
        </div>
      </div>
    </section>
  );
}

export function FormPedido(): ReactElement {
  const navigate = useNavigate();
  const farmacias = useFarmaciasStore((state) => state.farmacias);
  const setFarmacias = useFarmaciasStore((state) => state.setFarmacias);
  const adicionarPedido = usePedidosStore((state) => state.adicionar);
  const {
    control,
    handleSubmit,
    register,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PedidoFormInput, undefined, PedidoFormData>({
    resolver: zodResolver(pedidoSchema),
    defaultValues: {
      farmacia_id: "",
      latitude: "",
      longitude: "",
      peso_kg: "",
      prioridade: "2",
      descricao: "",
      janela_fim: "",
    },
  });
  const farmaciasQuery = useQuery({
    queryKey: ["farmacias"],
    queryFn: listFarmacias,
    staleTime: QUERY_STALE_TIME,
    enabled: farmacias.length === 0,
  });

  useEffect(() => {
    if (farmaciasQuery.data === undefined) {
      return;
    }

    setFarmacias(farmaciasQuery.data.farmacias);
  }, [farmaciasQuery.data, setFarmacias]);

  const farmaciasAtivasOptions = useMemo(
    () =>
      farmacias
        .filter((farmacia) => farmacia.ativa)
        .map((farmacia) => ({
          value: String(farmacia.id),
          label: `${farmacia.nome} - ${farmacia.cidade}`,
        })),
    [farmacias]
  );

  async function handleValidSubmit(data: PedidoFormData): Promise<void> {
    try {
      const pedidoCriado = await criarPedido(buildPedidoPayload(data));

      adicionarPedido(pedidoCriado);
      navigate(PEDIDOS_ROUTE_PATH);
    } catch (error) {
      if (!isValidationError(error) || error.detail === undefined) {
        setError("root", {
          type: "server",
          message: getErrorMessage(error),
        });
        return;
      }

      let hasMappedFieldError = false;

      for (const detail of error.detail) {
        const fieldName = getFieldNameFromLocation(detail.loc);

        if (fieldName === null) {
          continue;
        }

        hasMappedFieldError = true;
        setError(fieldName, {
          type: detail.type,
          message: detail.msg,
        });
      }

      if (hasMappedFieldError) {
        return;
      }

      setError("root", {
        type: "server",
        message: getErrorMessage(error),
      });
    }
  }

  if (farmacias.length === 0 && farmaciasQuery.isLoading) {
    return <FormSkeleton />;
  }

  if (farmacias.length === 0 && farmaciasQuery.isError) {
    return renderQueryError(getErrorMessage(farmaciasQuery.error) || LOAD_ERROR_MESSAGE);
  }

  return (
    <section className={PAGE_CLASS_NAME}>
      <div className={TOPBAR_CLASS_NAME}>
        <div className={TOPBAR_CONTENT_CLASS_NAME}>
          <nav aria-label="Breadcrumb" className={BREADCRUMB_CLASS_NAME}>
            <Link to={PEDIDOS_ROUTE_PATH} className={BREADCRUMB_LINK_CLASS_NAME}>
              Pedidos
            </Link>
            <span className="text-[var(--text-muted)]">/</span>
            <span className={BREADCRUMB_CURRENT_CLASS_NAME}>Novo Pedido</span>
          </nav>

          <div className={ACTIONS_CLASS_NAME}>
            <Button asChild variant="outline" type="button">
              <Link to={PEDIDOS_ROUTE_PATH}>Cancelar</Link>
            </Button>
            <Button form="pedido-form" type="submit" disabled={isSubmitting}>
              Salvar Pedido
            </Button>
          </div>
        </div>
      </div>

      <div className={CONTENT_CLASS_NAME}>
        <header className="flex flex-col gap-1">
          <h1 className={TITLE_CLASS_NAME}>Novo Pedido</h1>
          <p className={DESCRIPTION_CLASS_NAME}>
            Registre um novo destino para roteirizacao e monitoramento operacional.
          </p>
        </header>

        <form
          id="pedido-form"
          onSubmit={handleSubmit(handleValidSubmit)}
          className="flex flex-col gap-6"
        >
          <section className={CARD_CLASS_NAME}>
            <h2 className={CARD_TITLE_CLASS_NAME}>Destino</h2>
            <div className="flex flex-col gap-4">
              <FormSelect
                label="Farmacia de origem"
                name="farmacia_id"
                control={control}
                options={farmaciasAtivasOptions}
                placeholder="Selecione uma farmacia ativa"
                required
                disabled={farmaciasAtivasOptions.length === 0}
              />

              <div className={GRID_TWO_COLUMNS_CLASS_NAME}>
                <FormInput
                  label="Latitude"
                  required
                  type="number"
                  step="0.0001"
                  suffix="°"
                  hint={DECIMAL_COORDINATE_HINT}
                  error={getFieldError(errors.latitude)}
                  useDataFont
                  {...register("latitude")}
                />
                <FormInput
                  label="Longitude"
                  required
                  type="number"
                  step="0.0001"
                  suffix="°"
                  hint={DECIMAL_COORDINATE_HINT}
                  error={getFieldError(errors.longitude)}
                  useDataFont
                  {...register("longitude")}
                />
              </div>
            </div>
          </section>

          <section className={CARD_CLASS_NAME}>
            <h2 className={CARD_TITLE_CLASS_NAME}>Carga</h2>
            <div className="flex flex-col gap-4">
              <div className={GRID_TWO_COLUMNS_CLASS_NAME}>
                <FormInput
                  label="Peso"
                  required
                  type="number"
                  step="0.1"
                  suffix="kg"
                  error={getFieldError(errors.peso_kg)}
                  useDataFont
                  {...register("peso_kg")}
                />
                <FormInput
                  label="Descricao"
                  error={getFieldError(errors.descricao)}
                  placeholder="Insulina - UBS Centro"
                  autoComplete="off"
                  {...register("descricao")}
                />
              </div>

              <FormInput
                label="Janela de entrega"
                type="datetime-local"
                hint={DELIVERY_WINDOW_HINT}
                error={getFieldError(errors.janela_fim)}
                useDataFont
                {...register("janela_fim")}
              />
            </div>
          </section>

          <section className={CARD_CLASS_NAME}>
            <RadioGroup
              legend="Prioridade"
              name="prioridade"
              control={control}
              required
              options={[
                {
                  value: "1",
                  label: "P1 Urgente",
                  description: "Janela automatica de 1 hora.",
                },
                {
                  value: "2",
                  label: "P2 Normal",
                  description: "Janela automatica de 4 horas.",
                },
                {
                  value: "3",
                  label: "P3 Reabastecimento",
                  description: "Janela automatica de 24 horas.",
                },
              ]}
            />

            <div className={DIVIDER_CLASS_NAME} />

            {errors.root?.message ? (
              <p role="alert" className={ROOT_ERROR_CLASS_NAME}>
                {errors.root.message}
              </p>
            ) : null}

            <div className={FOOTER_ACTIONS_CLASS_NAME}>
              <Button asChild variant="outline" type="button">
                <Link to={PEDIDOS_ROUTE_PATH}>Cancelar</Link>
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                Salvar Pedido
              </Button>
            </div>
          </section>
        </form>
      </div>
    </section>
  );
}

export default FormPedido;
