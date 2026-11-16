#include <assert.h>
#include <stdio.h>
#include "../stm32_entry/gate_detector.h"
#include "../stm32_entry/reliable_uart.h"

static void line(ReliableUART *p, const char *s) {
    while (*s) pm_receive_byte(p, (unsigned char)*s++);
    pm_receive_byte(p, '\n');
}
static unsigned trace(const unsigned *states, unsigned length, unsigned initial) {
    GateDetector g; gate_init(&g, initial, 0, 80, PM_PASSAGE_TIMEOUT_MS);
    unsigned count=0; uint32_t now=0;
    for (unsigned i=0;i<length;++i) {
        now+=100; count+=(unsigned)gate_update(&g,states[i],now);
        count+=(unsigned)gate_update(&g,states[i],now+80);
    }
    return count;
}
int main(void) {
    ReliableUART p; pm_init(&p);
    assert(pm_enqueue(&p) && p.used==1 && !p.session[0]);
    line(&p,"SESSION aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    assert(!strcmp(p.session,"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"));
    line(&p,"SESSION bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    assert(p.session[0]=='a');
    line(&p,"ACK bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb 1"); assert(p.used==1);
    line(&p,"ACK aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 2"); assert(p.used==1);
    line(&p,"ACK 1"); assert(p.used==1);
    line(&p,"ACK aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 4294967297"); assert(p.used==1);
    line(&p,"ACK aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 1x"); assert(p.used==1);
    line(&p,"ACK aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 1"); assert(p.used==0);
    assert(pm_enqueue(&p) && p.queue[p.head]==2);
    line(&p,"ACK aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 1"); assert(p.used==1);
    for(unsigned i=0;i<200;++i) pm_receive_byte(&p,'x');
    line(&p,"ACK aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 2"); assert(p.used==1 && p.protocol_faults==1);
    line(&p,"ACK aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 2"); assert(p.used==0);
    for(unsigned i=0;i<PM_QUEUE_SIZE;++i) assert(pm_enqueue(&p));
    assert(!pm_enqueue(&p) && p.dropped==1 && p.used==PM_QUEUE_SIZE);
    for(unsigned i=0;i<PM_QUEUE_SIZE;++i) {
        char ack[96]; snprintf(ack,sizeof(ack),"ACK %s %lu",p.session,(unsigned long)p.queue[p.head]);
        line(&p,ack);
    }
    assert(p.used==0);
    p.sequence=UINT32_MAX; assert(!pm_enqueue(&p) && p.dropped==2);
    pm_init(&p); line(&p,"SESSION bad"); assert(!p.session[0]);
    line(&p,"SESSION AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"); assert(!p.session[0]);
    const unsigned forward[]={0,2,3,1,0}, reverse[]={0,1,3,2,0}, backout[]={0,2,3,2,0};
    const unsigned single[]={0,2,0}, simultaneous[]={0,3,1,0}, blocked[]={3,1,0};
    assert(trace(forward,5,0)==1); assert(trace(reverse,5,0)==0); assert(trace(backout,5,0)==0);
    assert(trace(single,3,0)==0); assert(trace(simultaneous,4,0)==0); assert(trace(blocked,3,2)==0);
    GateDetector gate; gate_init(&gate,0,0,80,PM_PASSAGE_TIMEOUT_MS);
    gate_update(&gate,2,100); gate_update(&gate,2,180);
    gate_update(&gate,3,200); gate_update(&gate,3,280);
    assert(!gate_update(&gate,3,31000) && gate.faults==1);
    gate_update(&gate,0,31100); assert(!gate_update(&gate,0,31180));
    gate_init(&gate,0,0,80,PM_PASSAGE_TIMEOUT_MS);
    const unsigned slow_states[]={2,3,1,0};
    const uint32_t slow_times[]={100,4100,10100,12100};
    unsigned count=0;
    for(unsigned i=0;i<4;++i) {
        count+=(unsigned)gate_update(&gate,slow_states[i],slow_times[i]);
        count+=(unsigned)gate_update(&gate,slow_states[i],slow_times[i]+80);
    }
    assert(count==1 && gate.faults==0);
    assert(!gate_update(&gate,0,32000));
    puts("Native C gate and UART ACK/queue checks passed (host execution, not board I/O)");
    return 0;
}
