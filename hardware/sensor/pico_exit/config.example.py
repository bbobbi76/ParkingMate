# Copy to private config.py; do not commit Wi-Fi passwords.
WIFI_SSID = ''
WIFI_PASSWORD = ''
BRIDGE_HOST = ''  # Laptop's numeric IPv4 on the same 2.4 GHz Wi-Fi.
BRIDGE_PORT = 9000
BRIDGE_TOKEN = ''  # Optional; match laptop BRIDGE_TOKEN, not backend SENSOR_KEY.
PIN_A = 14
PIN_B = 15
BLOCKED_LEVEL = 0  # Must match measured PC817 output when beam is blocked.
DEBOUNCE_MS = 80
PASSAGE_TIMEOUT_MS = 30000
MAX_PENDING = 128
DEBUG_USB = False  # Enable only while a USB serial monitor consumes diagnostics.
