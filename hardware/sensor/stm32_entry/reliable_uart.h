#ifndef PARKINGMATE_RELIABLE_UART_H
#define PARKINGMATE_RELIABLE_UART_H
#include <stdint.h>
#include <string.h>
#include <stdlib.h>

/* v3: RAM queue survives a USB/bridge outage while board power stays on.
 * Session is set once per boot by the bridge. ACK includes session AND seq. */
#define PM_QUEUE_SIZE 32U
typedef struct {
    char session[33], command[96];
    uint32_t queue[PM_QUEUE_SIZE], sequence, dropped, protocol_faults;
    unsigned head, used, command_len, discard_line;
} ReliableUART;

static inline void pm_init(ReliableUART *p) { memset(p, 0, sizeof(*p)); }

static inline int pm_enqueue(ReliableUART *p) {
    if (p->used == PM_QUEUE_SIZE || p->sequence == UINT32_MAX) {
        ++p->dropped; return 0;
    }
    p->queue[(p->head + p->used) % PM_QUEUE_SIZE] = ++p->sequence;
    ++p->used; return 1;
}

static inline void pm_command(ReliableUART *p, const char *line) {
    if (!strncmp(line, "SESSION ", 8)) {
        const char *s = line + 8;
        if (!p->session[0] && strlen(s) == 32 && strspn(s, "0123456789abcdef") == 32)
            memcpy(p->session, s, 33);
        return;
    }
    if (!strncmp(line, "ACK ", 4) && p->used && p->session[0]) {
        if (strlen(line) < 38 || strncmp(line + 4, p->session, 32) || line[36] != ' ') return;
        const char *digits = line + 37;
        if (!*digits || strlen(digits) > 10 || strspn(digits, "0123456789") != strlen(digits)) return;
        /* Parse with a checked bound even when unsigned long is only 32 bits. */
        uint32_t seq = 0;
        for (const char *c = digits; *c; ++c) {
            unsigned digit = (unsigned)(*c - '0');
            if (seq > (UINT32_MAX - digit) / 10U) return;
            seq = seq * 10U + digit;
        }
        if (seq && seq == p->queue[p->head]) {
            p->head = (p->head + 1) % PM_QUEUE_SIZE; --p->used;
        }
    }
}

static inline void pm_receive_byte(ReliableUART *p, unsigned char c) {
    if (c == '\n') {
        if (!p->discard_line) { p->command[p->command_len] = 0; pm_command(p, p->command); }
        p->command_len = 0; p->discard_line = 0;
    } else if (c != '\r' && !p->discard_line) {
        if (p->command_len < sizeof(p->command) - 1) p->command[p->command_len++] = (char)c;
        else { p->discard_line = 1; ++p->protocol_faults; }
    }
}
#endif
