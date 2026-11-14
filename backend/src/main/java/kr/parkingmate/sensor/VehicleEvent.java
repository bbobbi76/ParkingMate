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
@Table(name = "vehicle_event")
public class VehicleEvent {

    public enum Direction { IN, OUT }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String deviceId;
    private Long lotId;

    @Enumerated(EnumType.STRING)
    private Direction direction;

    private long seq;
    private Instant occurredAt;
    private Instant receivedAt;

    /** 이 입차와 짝지어진 이용권. 입차 1건 = 이용권 최대 1장. */
    private Long voucherId;

    protected VehicleEvent() {}

    public VehicleEvent(String deviceId, Long lotId, Direction direction, long seq, Instant occurredAt, Instant receivedAt) {
        this.deviceId = deviceId;
        this.lotId = lotId;
        this.direction = direction;
        this.seq = seq;
        this.occurredAt = occurredAt;
        this.receivedAt = receivedAt;
    }

    public void claimBy(Long voucherId) {
        this.voucherId = voucherId;
    }

    public Long getId() { return id; }
    public String getDeviceId() { return deviceId; }
    public Long getLotId() { return lotId; }
    public Direction getDirection() { return direction; }
    public long getSeq() { return seq; }
    public Instant getOccurredAt() { return occurredAt; }
    public Instant getReceivedAt() { return receivedAt; }
    public Long getVoucherId() { return voucherId; }
}
