"""Async Pico -> laptop bridge. HTTP 204 means durable receipt, not web delivery."""
import asyncio
import network
import time
import json

class Link:
    def __init__(self, config):
        self.config = config
        self.wlan = network.WLAN(network.WLAN.IF_STA)
        self.state = 'setup_required'
        self.ready = self.configured()
        self.wlan.active(self.ready)
        self.last_error = ''

    def configured(self):
        c = self.config
        try:
            parts = c.BRIDGE_HOST.split('.')
            ip_ok = len(parts) == 4 and all(p.isdigit() and 0 <= int(p) <= 255 for p in parts)
            ip_ok = ip_ok and 0 < int(parts[0]) < 224 and int(parts[0]) != 127
            token_ok = isinstance(c.BRIDGE_TOKEN, str) and all(33 <= ord(x) <= 126 for x in c.BRIDGE_TOKEN)
            return bool(c.WIFI_SSID and ip_ok and token_ok and 1 <= c.BRIDGE_PORT <= 65535)
        except (AttributeError, ValueError, TypeError):
            return False

    async def connect(self):
        if not self.ready:
            self.state = 'setup_required'
            return False
        if self.wlan.isconnected():
            return True
        self.state = 'wifi_connecting'
        try:
            self.wlan.disconnect()
            self.wlan.connect(self.config.WIFI_SSID, self.config.WIFI_PASSWORD)
            started = time.ticks_ms()
            while not self.wlan.isconnected():
                if self.wlan.status() < 0 or time.ticks_diff(time.ticks_ms(), started) > 15000:
                    raise OSError('Wi-Fi unavailable')
                await asyncio.sleep_ms(250)
        except OSError:
            try:
                self.wlan.disconnect()
            except OSError:
                pass
            self.state = 'wifi_unavailable'
            return False
        self.state = 'bridge_connecting'
        return True

    async def post(self, body, path='/event'):
        return await asyncio.wait_for(self._post(body, path), 10)

    async def _post(self, body, path):
        writer = None
        try:
            c = self.config
            reader, writer = await asyncio.open_connection(c.BRIDGE_HOST, c.BRIDGE_PORT)
            raw = json.dumps(body).encode()
            auth = ('X-Bridge-Key: %s\r\n' % c.BRIDGE_TOKEN) if c.BRIDGE_TOKEN else ''
            header = ('POST %s HTTP/1.0\r\nHost: %s:%d\r\n%sContent-Type: application/json\r\nContent-Length: %d\r\nConnection: close\r\n\r\n' %
                      (path, c.BRIDGE_HOST, c.BRIDGE_PORT, auth, len(raw))).encode()
            writer.write(header + raw)
            await writer.drain()
            first = await reader.readline()
            fields = first.split()
            if len(fields) < 2 or fields[1] not in (b'204', b'200'):
                raise OSError('Bridge did not acknowledge receipt')
            code = int(fields[1])
            header_bytes, content_length = len(first), None
            while True:
                line = await reader.readline()
                header_bytes += len(line)
                if header_bytes > 4096:
                    raise ValueError('HTTP headers too large')
                if line in (b'\r\n', b'\n'):
                    break
                if not line:
                    raise OSError('Incomplete HTTP headers')
                if line.lower().startswith(b'content-length:'):
                    content_length = int(line.split(b':', 1)[1].strip())
                if line.lower().startswith(b'transfer-encoding:'):
                    raise ValueError('Unsupported HTTP transfer encoding')
            if code == 200:
                if content_length is not None and not 0 <= content_length <= 2048:
                    raise ValueError('HTTP response too large')
                response = bytearray()
                while content_length is None or len(response) < content_length:
                    size = 256 if content_length is None else min(256, content_length - len(response))
                    chunk = await reader.read(size)
                    if not chunk:
                        break
                    response.extend(chunk)
                    if len(response) > 2048:
                        raise ValueError('HTTP response too large')
                if content_length is not None and len(response) != content_length:
                    raise OSError('Incomplete HTTP response')
                result = json.loads(bytes(response))
                if not isinstance(result, dict) or result.get('accepted') is not True:
                    raise ValueError('Event not acknowledged')
            self.state, self.last_error = 'online', ''
            return True
        finally:
            if writer is not None:
                writer.close()
                try:
                    await asyncio.wait_for(writer.wait_closed(), 1)
                except (OSError, asyncio.TimeoutError):
                    pass
