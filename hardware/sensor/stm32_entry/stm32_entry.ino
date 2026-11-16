// NUCLEO-F401RE: PC817 outputs -> D2 / PA10 (A), D3 / PB3 (B).
// Protocol 3: session + sequence + ACK. Use the matching laptop bridge.
#include "gate_detector.h"
#include "reliable_uart.h"
#include <stdio.h>
const int PIN_A = D2, PIN_B = D3, BROKEN = LOW;
const uint32_t DEBOUNCE_MS = 80, TIMEOUT_MS = PM_PASSAGE_TIMEOUT_MS;
static GateDetector gate;
static ReliableUART transport;
static uint32_t last_status = 0, last_pending = 0, led_at = 0;
static bool led_active = false;
static unsigned read_pair() {
  return (digitalRead(PIN_A) == BROKEN ? 2U : 0U)
       | (digitalRead(PIN_B) == BROKEN ? 1U : 0U);
}
void setup() {
  pinMode(PIN_A, INPUT_PULLUP); pinMode(PIN_B, INPUT_PULLUP);
  pinMode(LED_BUILTIN, OUTPUT); Serial.begin(115200);
  pm_init(&transport);
  gate_init(&gate, read_pair(), millis(), DEBOUNCE_MS, TIMEOUT_MS);
}
void loop() {
  uint32_t now = millis();
  unsigned budget = 96;
  while (Serial.available() && budget--) pm_receive_byte(&transport, (unsigned char)Serial.read());
  if (gate_update(&gate, read_pair(), now)) {
    (void)pm_enqueue(&transport); digitalWrite(LED_BUILTIN, HIGH);
    led_at = now; led_active = true;
  }
  if (led_active && (uint32_t)(now - led_at) >= 150) {
    digitalWrite(LED_BUILTIN, LOW); led_active = false;
  }
  if ((uint32_t)(now - last_status) >= 2000) {
    last_status = now;
    char line[320];
    snprintf(line, sizeof(line),
      "{\"kind\":\"status\",\"device\":\"entry-stm32\",\"protocol\":3,\"session\":\"%s\","
      "\"a\":%u,\"b\":%u,\"queue\":%u,\"dropped\":%lu,\"faults\":%lu}\n",
      transport.session, gate.state / 2, gate.state % 2, transport.used,
      (unsigned long)transport.dropped, (unsigned long)(gate.faults + transport.protocol_faults));
    Serial.print(line);
  }
  if ((uint32_t)(now - last_pending) >= 500) {
    last_pending = now;
    if (transport.used && transport.session[0]) {
      char line[256];
      snprintf(line, sizeof(line),
        "{\"kind\":\"passage\",\"device\":\"entry-stm32\",\"protocol\":3,"
        "\"session\":\"%s\",\"seq\":%lu,\"direction\":\"forward\"}\n",
        transport.session, (unsigned long)transport.queue[transport.head]);
      Serial.print(line);
    }
  }
}
