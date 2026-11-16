"""Forward-only two-beam detector. Both beams must overlap during passage."""
class Gate:
    PATH = (0, 2, 3, 1, 0)

    def __init__(self, initial, now, ticks_diff, debounce_ms=80, timeout_ms=30000):
        self.state = self.candidate = initial
        self.changed_at = self.started_at = now
        self.diff = ticks_diff
        self.debounce_ms = debounce_ms
        self.timeout_ms = timeout_ms
        self.stage = 0
        self.wait_clear = initial != 0
        self.faults = 0

    def update(self, raw, now):
        if self.stage and self.diff(now, self.started_at) >= self.timeout_ms:
            self.stage = 0
            self.wait_clear = self.state != 0
            self.faults += 1
        if raw != self.candidate:
            self.candidate, self.changed_at = raw, now
        if self.candidate == self.state or self.diff(now, self.changed_at) < self.debounce_ms:
            return False
        self.state = self.candidate
        if self.wait_clear:
            if self.state == 0:
                self.wait_clear = False
            return False
        if self.stage == 0:
            if self.state == 2:
                self.stage, self.started_at = 2, now
            elif self.state:
                self.wait_clear = True
                self.faults += 1
            return False
        if self.state == self.PATH[self.stage]:
            self.stage += 1
            if self.stage == len(self.PATH):
                self.stage = 0
                return True
        else:
            self.stage = 0
            self.wait_clear = self.state != 0
            self.faults += 1
        return False
