#ifndef PARKINGMATE_GATE_DETECTOR_H
#define PARKINGMATE_GATE_DETECTOR_H
#include <stdint.h>
#define PM_PASSAGE_TIMEOUT_MS 30000U
/* Clear -> A -> A+B -> B -> clear only. This cannot classify people/cars. */
typedef struct {
    unsigned state, candidate, stage, wait_clear;
    uint32_t changed_at, started_at, debounce_ms, timeout_ms, faults;
} GateDetector;
static inline void gate_init(GateDetector *g, unsigned initial, uint32_t now,
                             uint32_t debounce, uint32_t timeout) {
    g->state = g->candidate = initial;
    g->stage = 0; g->wait_clear = initial != 0;
    g->changed_at = g->started_at = now;
    g->debounce_ms = debounce; g->timeout_ms = timeout; g->faults = 0;
}
static inline int gate_update(GateDetector *g, unsigned raw, uint32_t now) {
    static const unsigned path[] = {0, 2, 3, 1, 0};
    if (g->stage && (uint32_t)(now - g->started_at) >= g->timeout_ms) {
        g->stage = 0; g->wait_clear = g->state != 0; ++g->faults;
    }
    if (raw != g->candidate) { g->candidate = raw; g->changed_at = now; }
    if (g->candidate == g->state || (uint32_t)(now - g->changed_at) < g->debounce_ms) return 0;
    g->state = g->candidate;
    if (g->wait_clear) { if (!g->state) g->wait_clear = 0; return 0; }
    if (!g->stage) {
        if (g->state == 2) { g->stage = 2; g->started_at = now; }
        else if (g->state) { g->wait_clear = 1; ++g->faults; }
        return 0;
    }
    if (g->state == path[g->stage]) {
        if (++g->stage == 5) { g->stage = 0; return 1; }
    } else { g->stage = 0; g->wait_clear = g->state != 0; ++g->faults; }
    return 0;
}
#endif
