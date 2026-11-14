package kr.parkingmate.sensor;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "sensor_device")
public class SensorDevice {

    public enum Gate { ENTRY, EXIT }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String deviceId;
    private Long lotId;

    @Enumerated(EnumType.STRING)
    private Gate gate;

    private Long lastSeq;
    private Instant lastSeenAt;

    protected SensorDevice() {}

    public void seen(Long seq, Instant at) {
        if (seq != null && (lastSeq == null || seq > lastSeq)) {
            lastSeq = seq;
        }
        lastSeenAt = at;
    }

    public Long getId() { return id; }
    public String getDeviceId() { return deviceId; }
    public Long getLotId() { return lotId; }
    public Gate getGate() { return gate; }
    public Long getLastSeq() { return lastSeq; }
    public Instant getLastSeenAt() { return lastSeenAt; }
}
