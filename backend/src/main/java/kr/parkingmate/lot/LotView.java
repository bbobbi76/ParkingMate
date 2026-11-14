package kr.parkingmate.lot;

import java.time.Instant;

/** 화면용 주차장 정보. level은 화면 색과 문구를 정하는 혼잡도. */
public record LotView(
        String code,
        String name,
        String category,
        double lat,
        double lng,
        String coordSource,
        Integer capacity,
        String capacitySource,
        Integer operableCapacity,
        int currentCount,
        Integer remaining,
        Level level,
        String manualStatus,
        boolean incentive,
        boolean sensorEnabled,
        boolean sensorOnline,
        Instant sensorLastSeenAt,
        String shuttleStop,
        String note,
        String dataSource,
        Instant updatedAt) {

    public enum Level { AVAILABLE, BUSY, FULL, CLOSED, UNKNOWN }

    public static LotView of(ParkingLot lot, Instant sensorLastSeenAt, boolean sensorOnline) {
        Integer cap = lot.effectiveCapacity();
        Integer remaining = cap == null ? null : Math.max(0, cap - lot.getCurrentCount());
        return new LotView(
                lot.getCode(), lot.getName(), lot.getCategory().name(), lot.getLat(), lot.getLng(),
                lot.getCoordSource(), lot.getCapacity(), lot.getCapacitySource(), lot.getOperableCapacity(),
                lot.getCurrentCount(), remaining, level(lot, cap, remaining), lot.getManualStatus().name(),
                lot.isIncentive(), lot.isSensorEnabled(), sensorOnline, sensorLastSeenAt,
                lot.getShuttleStop(), lot.getNote(), lot.getDataSource(), lot.getUpdatedAt());
    }

    static Level level(ParkingLot lot, Integer cap, Integer remaining) {
        return switch (lot.getManualStatus()) {
            case CLOSED -> Level.CLOSED;
            case FULL -> Level.FULL;
            case BUSY -> Level.BUSY;
            case AVAILABLE -> Level.AVAILABLE;
            case AUTO -> {
                if (cap == null) yield Level.UNKNOWN;
                if (remaining <= 0) yield Level.FULL;
                if (remaining < Math.max(1, cap * 0.2)) yield Level.BUSY;
                yield Level.AVAILABLE;
            }
        };
    }
}
