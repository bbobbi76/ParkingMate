"""Pico 2 WH: ordered exit passage -> durable queue -> laptop :9000/event."""
import asyncio
import machine
import os
import json
import time
from gate import Gate
from outbox import Outbox
from link import Link
try:
    import config
except ImportError:
    class config:
        pass
DEFAULTS = {
    'WIFI_SSID': '', 'WIFI_PASSWORD': '', 'BRIDGE_HOST': '', 'BRIDGE_PORT': 9000,
    'BRIDGE_TOKEN': '', 'BLOCKED_LEVEL': 0, 'PIN_A': 14, 'PIN_B': 15,
    'DEBOUNCE_MS': 80, 'PASSAGE_TIMEOUT_MS': 30000, 'MAX_PENDING': 128, 'DEBUG_USB': False,
}
for name, default in DEFAULTS.items():
    if not hasattr(config, name):
        setattr(config, name, default)
allowed_pins = tuple(range(23)) + (26, 27, 28)
if (config.PIN_A not in allowed_pins or config.PIN_B not in allowed_pins
        or config.PIN_A == config.PIN_B or config.BLOCKED_LEVEL not in (0, 1)
        or not 10 <= config.DEBOUNCE_MS <= 200
        or not 1000 <= config.PASSAGE_TIMEOUT_MS <= 120000
        or not 4 <= config.MAX_PENDING <= 256):
    raise ValueError('Invalid Pico GPIO or sampling configuration')
a_pin = machine.Pin(config.PIN_A, machine.Pin.IN, machine.Pin.PULL_UP)
b_pin = machine.Pin(config.PIN_B, machine.Pin.IN, machine.Pin.PULL_UP)
led = machine.Pin('LED', machine.Pin.OUT)

def read_pair():
    return int(a_pin.value() == config.BLOCKED_LEVEL) * 2 + int(b_pin.value() == config.BLOCKED_LEVEL)

gate = Gate(read_pair(), time.ticks_ms(), time.ticks_diff, config.DEBOUNCE_MS, config.PASSAGE_TIMEOUT_MS)
outbox = Outbox(config.MAX_PENDING)
link = Link(config)

def log(body):
    if config.DEBUG_USB:
        print(json.dumps(body))

def status():
    return {'deviceId': 'exit-pico', 'version': 'pico-exit-team-v3',
            'a': gate.state // 2, 'b': gate.state % 2, 'queue': len(outbox.items),
            'faults': gate.faults + outbox.faults + outbox.dropped, 'link': link.state,
            'configured': link.ready, 'storage_ok': not outbox.hard_fault and not outbox.write_fault,
            'dropped': outbox.dropped}

async def sample_sensors():
    while True:
        if gate.update(read_pair(), time.ticks_ms()):
            # Kept unchanged until receipt; backend seq is allocated ONLY by the bridge.
            event = {'deviceId': 'exit-pico', 'direction': 'OUT',
                     'eventId': ''.join('%02x' % n for n in os.urandom(16))}
            if outbox.append(event):
                log(event)
            else:
                log({'kind': 'fault', 'reason': 'pending_queue_unavailable'})
        await asyncio.sleep_ms(5)

async def deliver():
    last_heartbeat = time.ticks_ms() - 3000
    while True:
        if not link.ready:
            await asyncio.sleep(2)
            continue
        try:
            if not await link.connect():
                await asyncio.sleep(3)
                continue
            if outbox.items and not outbox.hard_fault:
                event = outbox.items[0]
                await link.post(event)
                outbox.acknowledge(event)
            if time.ticks_diff(time.ticks_ms(), last_heartbeat) >= 2000:
                last_heartbeat = time.ticks_ms()
                # Old bridges do not have this optional diagnostic endpoint.
                # A failed heartbeat must not block pending vehicle delivery.
                try:
                    await link.post(status(), '/heartbeat')
                except (OSError, ValueError, asyncio.TimeoutError):
                    link.state = 'heartbeat_unavailable'
            await asyncio.sleep_ms(100)
        except (OSError, ValueError, asyncio.TimeoutError) as error:
            link.last_error, link.state = type(error).__name__, 'bridge_unavailable'
            await asyncio.sleep(2)

async def indicate():
    while True:
        if link.state == 'online' and not outbox.hard_fault and not outbox.write_fault and not outbox.dropped:
            led.on()
        else:
            led.toggle()
        log(status())
        await asyncio.sleep(2)

async def run():
    log({'kind': 'boot', 'version': 'pico-exit-team-v3', 'configured': link.ready})
    await asyncio.gather(sample_sensors(), deliver(), indicate())

if __name__ == '__main__':
    try:
        asyncio.run(run())
    finally:
        led.off()
        asyncio.new_event_loop()
