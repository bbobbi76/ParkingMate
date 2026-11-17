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

    /** 현장 관리 화면에서 새로 추가하는 주차장. */
    public ParkingLot(String code, String name, Category category, double lat, double lng,
                      Integer capacity, int sortOrder, Instant now) {
        this.code = code;
        this.name = name;
        this.category = category;
        this.lat = lat;
        this.lng = lng;
        this.coordSource = "현장 관리 화면에서 지정";
        this.capacity = capacity;
        this.capacitySource = capacity != null ? "현장 관리 화면에서 입력" : null;
        this.manualStatus = ManualStatus.AUTO;
        this.incentive = category == Category.REMOTE;
        this.dataSource = "현장 관리 화면에서 추가";
        this.sortOrder = sortOrder;
        this.updatedAt = now;
    }

    public void rename(String value, Instant now) {
        name = value;
        updatedAt = now;
    }

    public void moveTo(double newLat, double newLng, Instant now) {
        lat = newLat;
        lng = newLng;
        coordSource = "현장 관리 화면에서 지정";
        updatedAt = now;
    }

    public void setCapacity(Integer value, Instant now) {
        capacity = value;
        capacitySource = value != null ? "현장 관리 화면에서 입력" : null;
        updatedAt = now;
    }

    public void setCategory(Category value, Instant now) {
        category = value;
        incentive = value == Category.REMOTE;
        updatedAt = now;
    }

    public void setShuttleStop(String value, Instant now) {
        shuttleStop = value == null || value.isBlank() ? null : value.trim();
        updatedAt = now;
    }

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
