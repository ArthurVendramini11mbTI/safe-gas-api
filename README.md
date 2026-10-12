# Safe Gas — backend

Backend local do protótipo de controle de GLP. O ESP2 detecta vazamento e avisa o ESP1 por ESP-NOW; o ESP1 fecha a válvula sem depender deste servidor. O backend recebe a situação consolidada do ESP1 por MQTT, guarda o histórico no PostgreSQL gerenciado pelo Supabase e oferece REST + Socket.IO ao site.

## Requisitos locais

- Node.js 24 ou mais recente
- Um projeto Supabase
- Mosquitto MQTT broker

Não há Docker nem autenticação de usuários. O backend e o broker MQTT rodam localmente; somente o banco de dados fica no Supabase.

No painel do Supabase, abra **Connect → ORMs → Prisma** e copie:

- a URL do pooler transacional para `DATABASE_URL`;
- a URL direta ou do session pooler para `DIRECT_URL`.

Use as URLs completas fornecidas pelo painel, incluindo SSL. Não compartilhe o arquivo `.env` nem o adicione ao Git. O backend usa somente a conexão PostgreSQL; não precisa de `anon key`, `service_role key`, Supabase Auth ou SDK do Supabase.

Instale e inicie o Mosquitto na porta padrão `1883`. O arquivo `mosquitto.conf` contém a configuração local usada pelo projeto e pode ser iniciado com:

```bash
mosquitto -c mosquitto.conf
```

## Inicialização

```bash
npm install
npm run prisma:generate
npm run prisma:deploy
npm run dev
```

Neste workspace, o arquivo `.env` já existe com valores-modelo. Em uma instalação nova, copie `.env.example` para `.env`. Substitua `PROJECT_REF`, `SUA_SENHA`, `SUA_REGIAO` e, preferencialmente, toda a URL pelos valores exibidos no painel antes de rodar os comandos.

A API ficará em `http://localhost:3000`, com documentação em `http://localhost:3000/docs`. A primeira execução de `prisma:deploy` cria as tabelas no Supabase. Para criar dados históricos de demonstração sem apagar dados existentes:

```bash
npm run prisma:seed
```

Para simular o ESP1 em outro terminal:

```bash
npm run simulate
```

O simulador aceita `leak`, `clear`, `weight 21.5`, `mq2 700`, `status` e `exit`.

## Organização

- `controllers`: entrada e resposta HTTP.
- `services`: regras de negócio e coordenação dos fluxos.
- `repository`: consultas e gravações feitas com Prisma.
- `schemas`: validações Zod de HTTP, MQTT e ambiente.
- `types`: contratos de domínio, MQTT e Socket.IO.
- `lib`: clientes e infraestrutura compartilhada.
- `routes`: declaração dos endpoints.
- `prisma`: schema, migration e seed.

Controllers e services não consultam o Prisma diretamente; todas as operações de banco passam pelos repositories.

## API REST

| Método | Rota | Finalidade |
|---|---|---|
| `GET` | `/health` | Saúde do backend, banco e MQTT |
| `GET` | `/api/status` | Estado atual completo |
| `GET/PUT` | `/api/settings` | Tara, capacidade e tolerâncias da balança |
| `GET` | `/api/gas/current` | Peso e quantidade atual de gás |
| `GET` | `/api/gas/history` | Leituras históricas (`from`, `to`, `limit`) |
| `GET` | `/api/gas/consumption?range=day` | Consumo por dia, semana ou mês |
| `GET` | `/api/leaks` | Histórico de vazamentos |
| `POST` | `/api/leaks/:id/acknowledge` | Solicita liberação do bloqueio ao ESP1 |
| `POST` | `/api/valve/commands` | Envia `{ "action": "OPEN" }` ou `CLOSE` |
| `GET` | `/api/valve/commands` | Histórico e resultado dos comandos |

O Socket.IO emite `telemetry.updated`, `valve.updated`, `leak.started`, `leak.cleared`, `leak.acknowledged`, `command.updated` e `device.connectivity`.

## Contrato MQTT

Os tópicos usam `safe-gas/esp1` como base, configurável por `MQTT_DEVICE_ID`.

### Telemetria — `safe-gas/esp1/telemetry`

```json
{
  "schemaVersion": 1,
  "deviceId": "esp1",
  "totalWeightKg": 22.5,
  "mq2Raw": 180,
  "leakActive": false,
  "valveState": "CLOSED",
  "esp2Online": true
}
```

### Presença — `safe-gas/esp1/status`

Mensagem retida com `{ "schemaVersion": 1, "deviceId": "esp1", "online": true }`. O ESP1 deve configurar uma Last Will igual, com `online: false`.

### Comandos — `safe-gas/esp1/commands`

Comandos QoS 1 e nunca retidos:

```json
{
  "schemaVersion": 1,
  "deviceId": "esp1",
  "commandId": "UUID",
  "type": "valve.set",
  "desiredState": "CLOSED"
}
```

O tipo `safety.reset` não possui `desiredState`. Ele libera a abertura somente se o vazamento já tiver terminado.

### Confirmação — `safe-gas/esp1/commands/ack`

```json
{
  "schemaVersion": 1,
  "deviceId": "esp1",
  "commandId": "UUID recebido",
  "status": "APPLIED",
  "valveState": "CLOSED"
}
```

Os status aceitos são `APPLIED`, `REJECTED` e `FAILED`, com `reason` opcional. Sem confirmação no prazo configurado, o backend marca o comando como `EXPIRED`.

## Segurança funcional

- O firmware deve iniciar sempre com a válvula fechada.
- O ESP1 fecha a válvula localmente ao receber o alerta do ESP2.
- O backend bloqueia abertura durante vazamento e antes do reconhecimento do último alerta.
- Reconhecer o alerta e abrir a válvula são duas ações separadas.
- O estado exibido é o estado do relé reportado pelo ESP1, não uma confirmação mecânica.
- A central fica offline depois de 90 segundos sem telemetria.

## Verificação

```bash
npm run typecheck
npm test
npm run build
```
# safe-gas-api
