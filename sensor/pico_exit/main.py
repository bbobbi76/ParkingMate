# Raspberry Pi Pico 2 WH (MicroPython) — 출구 차로 A·B 적외선 → 노트북 브리지로 전송
# 배선: PC817 입력회로 출력 → GP14(A), GP15(B), 3.3V 풀업. 빔이 끊기면 LOW 라고 가정 (반대면 BROKEN = 1).
# 차량 진행 방향: A(차로 안쪽) → B(바깥쪽) 순서로 끊기면 출차 1대.
import time
import network
import urequests
from machine import Pin

WIFI_SSID = "여기에_와이파이_이름"
WIFI_PASS = "여기에_비밀번호"
BRIDGE = "http://192.168.0.10:9000/event"   # 노트북 IP (ipconfig 로 확인)
DEVICE = "exit-pico"
BROKEN = 0
DEBOUNCE_MS = 80
TIMEOUT_MS = 8000   # A만 끊기고 B가 안 오면 무시 (사람·후진)

a = Pin(14, Pin.IN, Pin.PULL_UP)
b = Pin(15, Pin.IN, Pin.PULL_UP)
led = Pin("LED", Pin.OUT)


def wifi():
    w = network.WLAN(network.STA_IF)
    w.active(True)
    if not w.isconnected():
        w.connect(WIFI_SSID, WIFI_PASS)
        for _ in range(40):
            if w.isconnected():
                break
            time.sleep(0.5)
    print("wifi", w.isconnected(), w.ifconfig()[0])
    return w


def stable(pin):
    v = pin.value()
    time.sleep_ms(DEBOUNCE_MS)
    return v if pin.value() == v else None


def send(direction):
    led.on()
    for _ in range(3):
        try:
            urequests.post(BRIDGE, json={"deviceId": DEVICE, "direction": direction}).close()
            break
        except Exception as e:
            print("send fail", e)
            wifi()
            time.sleep(1)
    led.off()


w = wifi()
state = "IDLE"
t0 = 0
while True:
    av, bv = stable(a), stable(b)
    now = time.ticks_ms()
    if state == "IDLE" and av == BROKEN:
        state, t0 = "A", now                    # 차 앞부분이 A를 끊음
    elif state == "A" and bv == BROKEN:
        state = "AB"                            # 이어서 B도 끊김 → 방향 확정
    elif state == "AB" and av != BROKEN and bv != BROKEN:
        send("OUT")                             # 차가 완전히 빠져나감
        print("OUT")
        state = "IDLE"
    elif state == "A" and av != BROKEN and bv != BROKEN:
        state = "IDLE"                          # A만 잠깐 끊김(사람 등)
    if state != "IDLE" and time.ticks_diff(now, t0) > TIMEOUT_MS and state == "A":
        state = "IDLE"
    if not w.isconnected():
        w = wifi()
