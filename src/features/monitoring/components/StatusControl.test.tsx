import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import type { PedidoStatus } from "@/types/api";

import { StatusControl } from "./StatusControl";

const makeProps = (status: PedidoStatus) => ({
  status,
  pedidoId: 1,
  onCancelar: vi.fn(),
  onEntregar: vi.fn(),
});

describe("StatusControl", () => {
  it("status='em_voo' -> todos os botoes ficam disabled", () => {
    render(<StatusControl {...makeProps("em_voo")} />);

    const buttons = screen.getAllByRole("button");

    buttons.forEach((button) => {
      expect(button).toBeDisabled();
    });
  });

  it("status='pendente' -> botao 'Cancelar Pedido' visivel e habilitado", () => {
    render(<StatusControl {...makeProps("pendente")} />);

    expect(
      screen.getByRole("button", { name: "Cancelar Pedido" }),
    ).toBeEnabled();
  });

  it("status='calculado' -> confirmar cancelamento chama onCancelar 1x", async () => {
    const user = userEvent.setup();
    const props = makeProps("calculado");

    render(<StatusControl {...props} />);

    await user.click(screen.getByRole("button", { name: "Cancelar Pedido" }));
    await user.click(
      screen.getByRole("button", { name: "Confirmar cancelamento" }),
    );

    expect(props.onCancelar).toHaveBeenCalledTimes(1);
  });

  it("status='calculado' -> cancelar dialog nao chama onCancelar", async () => {
    const user = userEvent.setup();
    const props = makeProps("calculado");

    render(<StatusControl {...props} />);

    await user.click(screen.getByRole("button", { name: "Cancelar Pedido" }));
    await user.click(screen.getByRole("button", { name: "Fechar" }));

    expect(props.onCancelar).not.toHaveBeenCalled();
  });

  it("status='entregue' -> badge visivel sem botoes de acao", () => {
    render(<StatusControl {...makeProps("entregue")} />);

    expect(screen.getByText("Entregue ✓")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Cancelar Pedido" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Confirmar Entrega Manual" }),
    ).not.toBeInTheDocument();
  });

  it("status='em_voo' -> botao 'Confirmar Entrega Manual' presente mas disabled", () => {
    render(<StatusControl {...makeProps("em_voo")} />);

    expect(
      screen.getByRole("button", { name: "Confirmar Entrega Manual" }),
    ).toBeDisabled();
  });
});
