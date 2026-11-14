// STM32 NUCLEO-F401RE (Arduino IDE + STM32duino 보드 패키지) — 입구 차로 A·B 적외선
// 배선: PC817 입력회로 출력 → D2(A), D3(B), 3.3V 풀업. 빔이 끊기면 LOW 라고 가정 (반대면 BROKEN = HIGH).
// 차량이 A(바깥쪽) → B(주차장 안쪽) 순서로 지나가면 "IN" 한 줄을 USB 시리얼(ST-LINK 가상 COM)로 보낸다.
// 노트북에서는 sensor/bridge.py --serial COMx 로 받는다.

const int PIN_A = D2;
const int PIN_B = D3;
const int BROKEN = LOW;
const unsigned long DEBOUNCE_MS = 80;
const unsigned long TIMEOUT_MS = 8000;

enum State { IDLE, ONLY_A, BOTH };
State state = IDLE;
unsigned long t0 = 0;

bool readStable(int pin) {
  int v = digitalRead(pin);
  delay(DEBOUNCE_MS);
  return digitalRead(pin) == v ? (v == BROKEN) : false;
}

void setup() {
  pinMode(PIN_A, INPUT_PULLUP);
  pinMode(PIN_B, INPUT_PULLUP);
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(115200);
}

void loop() {
  bool a = readStable(PIN_A);
  bool b = readStable(PIN_B);
  unsigned long now = millis();

  switch (state) {
    case IDLE:
      if (a) { state = ONLY_A; t0 = now; }
      break;
    case ONLY_A:
      if (b) state = BOTH;                       // 방향 확정: 바깥 → 안
      else if (!a || now - t0 > TIMEOUT_MS) state = IDLE;  // 사람·후진 무시
      break;
    case BOTH:
      if (!a && !b) {                            // 차가 완전히 통과
        Serial.println("IN");
        digitalWrite(LED_BUILTIN, HIGH);
        delay(150);
        digitalWrite(LED_BUILTIN, LOW);
        state = IDLE;
      }
      break;
  }
}
