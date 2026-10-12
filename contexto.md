# Contexto para corrigir o Wi-Fi do ESP1

## Objetivo

Corrigir a reconexão Wi-Fi do firmware da central ESP1 do projeto Safe Gas e validar a comunicação MQTT com o backend.

## Diretórios envolvidos

- Backend atualmente analisado:
  `/home/arthurvendra/projetos/safe-gas/safe-gas-api`
- Firmware que deve ser aberto em outro workspace:
  `/home/arthurvendra/projetos/safe-gas/SafeGas_PlatformIO/ESP1_Central`

O firmware não pôde ser editado na conversa anterior porque estava fora do workspace com permissão de escrita.

## Sintoma

O monitor serial exibiu repetidamente:

```text
E (...) wifi:sta is connecting, return error
```

Depois, o terminal passou a mostrar caracteres ilegíveis.

## Diagnóstico realizado

No firmware, a função `tarefaRede` chama `WiFi.begin(...)` inicialmente e, enquanto a conexão não foi estabelecida, chama `WiFi.reconnect()` a cada 8 segundos. A nova chamada pode acontecer enquanto o driver ainda está tentando se conectar, produzindo a mensagem `sta is connecting, return error`.

Os baud rates já estão consistentes:

- `ESP1_Central/src/main.cpp`: `Serial.begin(115200);`
- `ESP1_Central/platformio.ini`: `monitor_speed = 115200`

Portanto, não é necessário mudar esses valores. Os caracteres ilegíveis podem ter vindo de um terminal comum ou de uma sessão serial aberta com parâmetros diferentes. Deve-se usar **PlatformIO: Serial Monitor** após fechar qualquer outro monitor conectado à mesma porta.

## Alteração solicitada

Editar:

```text
/home/arthurvendra/projetos/safe-gas/SafeGas_PlatformIO/ESP1_Central/src/main.cpp
```

Na função `tarefaRede`, trocar:

```cpp
uint32_t ultimaTentativaWiFi = 0;
```

por:

```cpp
uint32_t ultimaTentativaWiFi = millis();
```

Substituir o início atual do ciclo de conexão:

```cpp
WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
for (;;) {
  const uint32_t agora = millis();
  if (WiFi.status() != WL_CONNECTED) {
    if (agora - ultimaTentativaWiFi >= 8000) {
      ultimaTentativaWiFi = agora;
      WiFi.reconnect();
    }
    vTaskDelay(pdMS_TO_TICKS(100));
    continue;
  }
```

por:

```cpp
Serial.printf("Conectando ao Wi-Fi '%s'...\n", WIFI_SSID);
WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

for (;;) {
  const uint32_t agora = millis();

  if (WiFi.status() != WL_CONNECTED) {
    if ((uint32_t)(agora - ultimaTentativaWiFi) >= 15000) {
      ultimaTentativaWiFi = agora;

      Serial.printf(
        "Wi-Fi desconectado (status=%d); tentando novamente...\n",
        static_cast<int>(WiFi.status())
      );

      // Cancela a tentativa anterior antes de iniciar uma nova.
      WiFi.disconnect(false, false);
      vTaskDelay(pdMS_TO_TICKS(250));
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    }

    vTaskDelay(pdMS_TO_TICKS(100));
    continue;
  }
```

É recomendável também registrar eventos de desconexão e seus códigos de motivo, caso a API da versão instalada do Arduino ESP32 permita, para distinguir senha incorreta, SSID não encontrado e timeout.

## Rede e MQTT

- O teste está sendo feito com o hotspot do celular.
- O hotspot deve operar em 2,4 GHz e, preferencialmente, WPA2.
- O computador e o ESP1 precisam estar conectados ao mesmo hotspot.
- `MQTT_HOST` no `include/secrets.h` deve ser o endereço IP do computador dentro da rede do hotspot.
- Não usar `localhost` nem `127.0.0.1` no ESP1.
- Confirmar o IP atual do computador com `hostname -I`.
- O Mosquitto do backend escuta na porta `1883` em `0.0.0.0` e permite conexão anônima no ambiente de protótipo.

## Segurança

A senha do hotspot apareceu em uma captura de tela. Ela deve ser alterada. Não reproduzir a senha no código de contexto, em commits ou em mensagens. O arquivo `include/secrets.h` deve permanecer ignorado pelo Git.

## Validação esperada

No novo workspace:

1. Aplicar a alteração no `main.cpp`.
2. Compilar o firmware com PlatformIO.
3. Gravar o firmware no ESP1.
4. Fechar outros terminais seriais.
5. Abrir **PlatformIO: Serial Monitor** em `115200`.
6. Reiniciar a placa e capturar as mensagens desde o boot.
7. Confirmar que o ESP1 obtém um endereço IP.
8. Confirmar que aparece a mensagem de MQTT conectado.

Se o Wi-Fi continuar falhando, usar o `status` ou o código de motivo da desconexão para continuar o diagnóstico.
