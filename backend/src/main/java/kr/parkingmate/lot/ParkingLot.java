package kr.parkingmate.lot;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;

@Entity
@Table(name = "parking_lot")
public class ParkingLot {

    public enum Category { NEAR, SHUTTLE, REMOTE, ACCESSIBLE, CAMPING }

    /** AUTO = 면수와 차량 수로 계산. 나머지는 직원이 직접 지정(눈, 면수 미확인 등). */
    public enum ManualStatus { AUTO, AVAILABLE, BUSY, FULL, CLOSED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String code;
    private String name;

    @Enumerated(EnumType.STRING)
    private Category category;

    private double lat;
    private double lng;
    private String coordSource;
    private Integer capacity;
    private String capacitySource;
    private Integer operableCapacity;
    private int currentCount;

    @Enumerated(EnumType.STRING)
    private ManualStatus manualStatus;

    private boolean incentive;
    private boolean sensorEnabled;
    private String shuttleStop;
    private String note;
    private String dataSource;
    private int sortOrder;
    private Instant updatedAt;

    @Version
    @Column(nullable = false)
    private long version;

    protected ParkingLot() {}

    /** 눈 등으로 줄어든 운영 가능 면수가 있으면 그것을, 없으면 전체 면수를 쓴다. */
    public Integer effectiveCapacity() {
        return operableCapacity != null ? operableCapacity : capacity;
    }

    public void applyDelta(int delta, Instant now) {
        currentCount = Math.max(0, currentCount + delta);
        updatedAt = now;
    }

    public void setCurrentCount(int count, Instant now) {
        currentCount = Math.max(0, count);
        updatedAt = now;
    }

    public void setOperableCapacity(Integer value, Instant now) {
        operableCapacity = value;
        updatedAt = now;
    }

    public void setManualStatus(ManualStatus status, Instant now) {
        manualStatus = status;
        updatedAt = now;
    }

    public Long getId() { return id; }
    public String getCode() { return code; }
    public String getName() { return name; }
    public Category getCategory() { return category; }
    public double getLat() { return lat; }
    public double getLng() { return lng; }
    public String getCoordSource() { return coordSource; }
    public Integer getCapacity() { return capacity; }
    public String getCapacitySource() { return capacitySource; }
    public Integer getOperableCapacity() { return operableCapacity; }
    public int getCurrentCount() { return currentCount; }
    public ManualStatus getManualStatus() { return manualStatus; }
    public boolean isIncentive() { return incentive; }
    public boolean isSensorEnabled() { return sensorEnabled; }
    public String getShuttleStop() { return shuttleStop; }
    public String getNote() { return note; }
    public String getDataSource() { return dataSource; }
    public int getSortOrder() { return sortOrder; }
    public Instant getUpdatedAt() { return updatedAt; }
}
