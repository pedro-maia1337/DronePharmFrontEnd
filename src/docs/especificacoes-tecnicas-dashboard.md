# Especificações Técnicas de Implementação (Dashboard Web)

**Contexto Geral:** As implementações abaixo visam o refinamento do dashboard de simulação na web. O agente deve focar na fidelidade dos dados em tempo real e na melhoria da experiência de gerenciamento da frota.

---

## 1. Sistema de Bateria e Gestão de Drones

**Objetivo:** Criar interface de gerenciamento individual dos drones com foco no controle do estado da bateria.

### Aba de Edição de Drones

- Criar um modal ou painel lateral (Drawer) alimentado pelos dados de `GET /api/v1/drones/{drone_id}` ou `GET /api/v1/frota/{drone_id}/resumo`.
- Permitir a edição manual de status e nível de bateria utilizando o endpoint `PATCH /api/v1/drones/{drone_id}` no payload:

```json
{
  "status": "...",
  "bateria_pct": 0.0
}
```

### Ação de Carregamento (Charging)

- Adicionar um botão de ação rápida **"Recarregar Drone"**.
- Ao iniciar o carregamento, a interface deve fazer uma requisição para `PATCH /api/v1/drones/{drone_id}/status` passando o parâmetro de query `status=carregando`.
- Ao concluir a simulação de recarga na interface, acionar o endpoint `POST /api/v1/frota/{drone_id}/reativar` passando a query `bateria_pct=1.0` para retornar o drone ao status `aguardando` com bateria cheia.

---

## 2. Ajuste de Velocidade, ETA e Fidelidade de Métricas

> **Atenção:** As diretrizes desta seção devem ser aplicadas especificamente ao fluxo contínuo da funcionalidade **"Simular agora"** (início imediato da simulação em background).

### Velocidade Real do Monitoramento

O deslocamento do drone e a atualização da trajetória na tela devem ocorrer estritamente em velocidade real (1x). A interface deve apenas renderizar os pacotes de dados na mesma cadência natural em que são gerados pelo backend (a cada 2 segundos), eliminando qualquer interpolação acelerada ou pressa artificial no frontend.

### Correção de ETA e Tempos Previstos

Remover por completo qualquer lógica de cálculo de tempo estimado de chegada (ETA) feito de forma isolada pelo cliente. O painel de acompanhamento deve apenas ler e exibir o tempo restante e as estimativas calculadas estritamente pelo servidor.

### Fidelidade Absoluta das Métricas

Garantir paridade matemática de 100% entre os contadores do dashboard (pedidos em voo, ativos, concluídos e taxa de pontualidade) e o estado consolidado da máquina de estados no backend.

### Testes de Validação

Elaborar testes automatizados de integração no frontend (ex: Jest/React Testing Library) simulando o recebimento das estruturas de dados do servidor. Os testes devem garantir que:

- Os componentes de interface exibam os KPIs e os frames de telemetria de forma idêntica à recebida.
- Nenhuma mutação ou arredondamento inadequado ocorra na UI.

---

## 3. Melhorias de UI/UX (Legibilidade e Temas)

**Objetivo:** Otimizar a visualização dos componentes geoespaciais em diferentes condições de iluminação da interface.

### Modo Claro (Light Mode)

Implementar um theme provider que suporte a alternância completa entre modo claro e escuro em toda a aplicação.

### Legibilidade do Mapa Interativo

- Ajustar o contraste das camadas renderizadas a partir dos retornos em GeoJSON (depósito, pedidos e rotas).
- No modo claro, as trajetórias (LineStrings) e os pontos de parada (Waypoints) devem adotar paletas de cores mais escuras ou contornos (strokes) de alto contraste.
- Garantir que os ícones representativos da frota circulante e o marcador do depósito principal mantenham excelente visibilidade, independentemente do estilo de mapa base (base map) selecionado.
- Especificar melhor os pontos de melhoria.