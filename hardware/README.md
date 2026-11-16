# ParkingMate 하드웨어 · 박서빈

STM32 입구, Raspberry Pi Pico 2 WH 출구, 노트북 수신·저장·웹 연결 코드를 모은 폴더입니다. 2026-11-16까지 직접 사용한 코드를 기준으로 정리했습니다.

**현재 실물 보드의 protocol 3 / eventId 프로그램은 이 폴더의 브리지와 함께 사용합니다.** 저장소 루트의 `sensor/`는 기존 구형 예시입니다. 구형 `IN` 한 줄 브리지와 새 보드 프로그램을 섞지 않습니다.

## 전체 흐름

```text
입구 PRO10A A/B → PC817 → STM32 ─ USB ─┐
                                      ├→ 노트북 → 배포 서버 → DB → 배포 웹
출구 PRO10A A/B → PC817 → Pico ─ Wi-Fi ─┘
```

- 입구 장치: `entry-stm32`, STM32 NUCLEO-F401RE, D2/PA10=A, D3/PB3=B.
- 출구 장치: `exit-pico`, Pico 2 WH, GP14=A, GP15=B.
- 입력: PC817 출력측 0~3.3V, 차단 시 LOW(0). 센서 배터리 전압을 GPIO에 직접 연결하지 않습니다.
- 판정: **비움 → A만 가림 → 둘 다 가림 → B만 가림 → 비움**을 완성하면 한 번 집계합니다.
- 디바운스 80ms, 통과 제한 30초. 역방향·한 빔만 가림·겹침 없는 통과·되돌아감은 제외합니다.
- 두 빔은 차량 진행 방향으로 앞뒤에 설치합니다. 사람/차량 구분과 붙어 지나가는 두 차량 분리는 보장하지 않습니다.

## 폴더 구성

| 경로 | 역할 |
|---|---|
| `sensor/stm32_entry/src/main.c` | STM32 C/HAL 기준 펌웨어 |
| `sensor/stm32_entry/stm32_entry.ino` | 동일 판정·통신 헤더를 사용하는 Arduino 대안 |
| `sensor/pico_exit/` | Pico MicroPython 입력 판정·Wi-Fi·재전송·영구 대기열 |
| `sensor/bridge.py`, `bridge_store.py` | 양쪽 보드 수신, SQLite 저장, 중복 제거, 서버 전송 |
| `sensor/field_monitor.py`, `field_dashboard.html` | 로컬 카운터와 웹 전송 상태 화면 |
| `sensor/web_connect.py` | 서버 주소·센서 키 두 값으로 웹 연결하는 창 |
| `sensor/tests/` | 판정·ACK·저장·재전송·설정·격리된 서버 연동 검사 |
| `웹담당자_전달사항.txt` | 웹/서버 담당자에게 전달할 API·DB 설정 |
| `웹연결_사용방법.txt` | 웹 연결 창 사용법 |

## 다른 노트북에서 처음 실행하기 · Windows

1. 저장소를 내려받고 Python 3.11 이상을 설치합니다. 설치 시 PATH와 tkinter를 포함합니다.
2. 이 폴더의 **`setup.cmd`**를 실행합니다. `hardware/.venv/`를 만들고 노트북용 의존성을 설치합니다. 최초 설치에는 인터넷이 필요합니다.
3. STM32 USB, 센서 전원, Pico 전원을 연결합니다. Pico와 노트북은 서로 통신할 수 있는 **같은 2.4GHz Wi-Fi/핫스팟**에 연결합니다.
4. 새 노트북/Wi-Fi로 옮겼다면 아래 Pico 설정에서 Wi-Fi와 **노트북의 해당 네트워크 IPv4**를 다시 넣어야 합니다. Pico가 보내는 곳은 노트북의 9000 포트이며 `127.0.0.1`이나 배포 서버 주소가 아닙니다.

이 폴더를 다른 경로에 내려받아도 실행할 수 있습니다. 원래 개발 노트북의 가상환경·바탕화면 바로가기·COM 번호·네트워크 설정은 포함하지 않았습니다.

## 현장 카운터만 보기

**`현장테스트_시작.cmd`**를 실행하고 `http://127.0.0.1:9000/`을 엽니다.

- 큰 숫자 하나에 **입차 +1 / 출차 −1**을 표시합니다. 테스트 시작 이후 변화량이므로 음수가 될 수 있고, 실제 시작 주차 대수를 포함하지 않습니다.
- STM32/Pico 연결 상태와 A/B 차단 상태, 최근 통과 기록을 표시합니다. 센서 상태 표시는 약 2초마다 갱신되며 보드 판정은 계속 실행됩니다.
- `새 테스트`는 표시를 0부터 시작하고 기존 기록·중복 방지 이력을 보관합니다. `기록 저장`은 CSV로 내보냅니다.
- 현장 모드는 `sensor/field-runtime/`에 저장하고 팀 서버에는 보내지 않습니다. 실행 화면에는 인터넷이 필요 없지만 Pico와 노트북 사이 Wi-Fi는 유지해야 합니다.
- Windows 핫스팟을 자동으로 켜려고 시도합니다. 시작할 수 없는 네트워크 환경에서는 Windows에서 핫스팟을 준비하고 Pico의 `연결됨`을 확인합니다.
- 실행 중 자동 절전을 억제하지만 노트북 덮개를 닫거나 전원을 끄면 수신할 수 없습니다.
- 다른 브리지가 9000 포트를 사용 중이면 먼저 해당 프로그램을 종료합니다. 기존 웹 전송 모드가 실행 중이면 같은 카운터를 열며 모드를 임의 전환하지 않습니다.

## 배포 웹에 연결하기

1. [웹담당자_전달사항.txt](웹담당자_전달사항.txt)를 웹 담당자에게 전달하고 **백엔드 원본 주소와 SENSOR_KEY**를 받습니다. `/api`는 주소 뒤에 붙이지 않습니다.
2. 노트북 인터넷, STM32 USB, Pico Wi-Fi를 준비하고 설정 전환 중에는 센서 통과를 멈춥니다.
3. **`웹연결_시작.cmd`**를 열고 두 값을 입력한 뒤 **`연결 확인 후 시작`**을 누릅니다.
4. 차량 수를 바꾸지 않는 빈 요청으로 서버 인증을 확인합니다. 실패하면 기존 수신 프로그램을 유지합니다.
5. 성공하면 기존 현장 카운터를 정상 종료하고 웹 전송용 카운터를 같은 주소에 엽니다. 다음 실행부터 두 값을 불러옵니다.
6. 화면의 `웹 전송 모드`, 두 보드의 `연결됨`, 통과 후 `서버 확인`을 확인합니다. 배포 웹의 숫자가 바뀌는지는 웹 담당자와 함께 확인합니다.

예전 현장 시험 기록은 자동 전송하지 않습니다. 웹 전송 모드에서 받은 통과와 같은 서버의 미전송 기록만 보냅니다. 인터넷/서버 오류 때는 저장하고 동일 ID로 재시도합니다. 서버별 DB는 `sensor/web-runtime/`에 보관합니다. 지우면 재전송·중복 방지 이력이 사라집니다.

`표시 초기화`는 노트북 화면만 0부터 시작합니다. 서버 차량 수·DB·미전송 기록은 바뀌지 않습니다. 설정 창을 닫아도 수신은 계속되며 종료는 카운터의 `수신 프로그램 종료`를 사용합니다.

## 보드 설정·설치 · 필요할 때만

아래 PowerShell 명령은 **이 `hardware/` 폴더**에서 실행합니다.

```powershell
# 노트북 실행만 할 때는 설치하지 않아도 되는 보드 도구
.\.venv\Scripts\python.exe -m pip install -r requirements-firmware.txt

# Pico: Pico 2 W용 MicroPython을 먼저 설치한 보드, USB 연결
# Wi-Fi·비밀번호·노트북 IPv4를 입력하고 펌웨어 파일을 설치
PowerShell -ExecutionPolicy Bypass -File .\sensor\pico_exit\configure.ps1

# STM32: 연결된 NUCLEO-F401RE에 빌드·설치
PowerShell -ExecutionPolicy Bypass -File .\sensor\stm32_entry\flash.ps1
```

펌웨어 재설치 전 센서 통과를 멈추고 보드 대기열이 0인지 확인합니다. STM32 업로드 전 수신 프로그램도 종료합니다. STM32 설치는 RAM 대기열을 지우며, 기본 프로그램은 C/HAL입니다. Arduino `.ino`는 이번 실물 설치 대상이 아니었습니다.

Pico는 `main.py`, `gate.py`, `outbox.py`, `link.py`, 비공개 `config.py`를 함께 사용합니다. `main.py`만 복사하지 않습니다. 업로더는 기존 파일 백업 → 임시 업로드 → 보드에서 문법 검사 → 활성화 → 재시작을 진행합니다. Wi-Fi 설정은 PC와 보드에만 저장합니다.

## 통신 약속

| 구간 | 형식·보장 |
|---|---|
| STM32 → 노트북 | USB 115200bps, protocol 3 JSON, 부팅 session + seq. `ACK <session> <seq>` 전에는 같은 기록 재전송 |
| Pico → 노트북 | `POST /event`, `deviceId=exit-pico`, `direction=OUT`, `eventId` 고정 재전송. 저장 후 HTTP 204 |
| 노트북 → 서버 | `POST /api/sensor/events`, `X-Sensor-Key`, `{events:[{deviceId,seq,direction,occurredAt}]}` |
| 서버 완료 판단 | HTTP 200, `accepted + duplicates = 1`, `errors = []` 모두 충족. 실패 시 같은 seq 재전송 |
| 연결 상태 알림 | 실제 최근 보드 신호가 있을 때만 서버 `/api/sensor/heartbeat` 호출 |

장치 ID `entry-stm32`, `exit-pico`와 대상 주차장 `wirari`를 웹 담당자와 맞춥니다. 웹은 브리지와 같은 백엔드를 사용하고 서버 `currentCount`/`remaining`을 읽습니다. 센서 키는 브라우저에 넣지 않습니다.

노트북의 수신 확인은 저장 완료를 뜻하며 서버/웹 반영과 다릅니다. STM32 RAM 대기열 32건은 전원 차단·리셋 시 유지되지 않습니다. Pico 영구 대기열 128건도 저장 전 정전·용량 초과·저장장치 고장까지 무손실을 보장하지 않습니다. 양쪽이 끊겼다 다시 연결되면 실제 발생 순서와 수신 순서가 다를 수 있습니다.

## 검사와 확인 범위

```powershell
# hardware/ 폴더에서. 실제 보드·배포 DB에 가짜 통과를 보내지 않음
.\.venv\Scripts\python.exe -m unittest discover -s sensor/tests -v

# 선택: x64 Native Tools Command Prompt for Visual Studio에서
.\sensor\tests\run_native.cmd

# 선택: 저장소 backend의 app.jar를 빌드한 뒤, 임시 H2 서버로 검증
.\.venv\Scripts\python.exe sensor/tests/check_team_backend.py
```

2026-11-16까지 STM32·Pico의 손으로 가리는 순방향 통과, 노트북 저장·ACK, 카운터 증가를 확인했습니다. 느린 수동 통과를 위해 제한을 8초에서 30초로 바꿨습니다. 소프트웨어 검사는 판정, 재전송, 중복 방지, 설정 실패 보존, 격리된 서버 전송·재시작을 포함합니다. **실제 차량의 실외 정확도와 실제 배포 서버·웹 반영은 별도 현장 검증이 필요합니다.**

## 공유하지 않는 파일

- `.venv/`, `.pio/`, `__pycache__/`: 실행 환경·빌드 산출물
- `sensor/pico_exit/config.py`, `.local/`: Wi-Fi 비밀번호·보드 백업
- `sensor/runtime/`, `sensor/field-runtime/`, `sensor/web-runtime/`: 센서 키·DB·로그·테스트 기록

Git에는 위 파일을 제외하고 소스·설정 예시·검사·안내만 포함했습니다. 설정 예시는 `sensor/pico_exit/config.example.py`, `sensor/connection.example.json`을 참고합니다.
