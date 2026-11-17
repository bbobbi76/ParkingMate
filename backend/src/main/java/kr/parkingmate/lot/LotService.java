package kr.parkingmate.lot;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import kr.parkingmate.common.ApiException;
import kr.parkingmate.common.AppProperties;
import kr.parkingmate.sensor.SensorDeviceRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LotService {

    private final ParkingLotRepository lots;
    private final SensorDeviceRepository devices;
    private final AppProperties props;
    private final Clock clock;

    public LotService(ParkingLotRepository lots, SensorDeviceRepository devices, AppProperties props, Clock clock) {
        this.lots = lots;
        this.devices = devices;
        this.props = props;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<LotView> list() {
        Map<Long, Instant> seen = devices.lastSeenByLot();
        return lots.findAllByOrderBySortOrderAsc().stream().map(l -> view(l, seen.get(l.getId()))).toList();
    }

    @Transactional(readOnly = true)
    public LotView get(String code) {
        ParkingLot lot = lots.findByCode(code).orElseThrow(() -> ApiException.notFound("주차장"));
        return view(lot, devices.lastSeenByLot().get(lot.getId()));
    }

    public record AdminUpdate(Integer currentCount, Integer delta, Integer operableCapacity,
                              Boolean clearOperableCapacity, ParkingLot.ManualStatus manualStatus,
                              String name, Double lat, Double lng, Integer capacity, Boolean clearCapacity,
                              ParkingLot.Category category, String shuttleStop) {}

    public record CreateLot(String name, ParkingLot.Category category, Integer capacity,
                            Double lat, Double lng, String shuttleStop) {}

    @Transactional
    public LotView create(CreateLot req) {
        if (req.name() == null || req.name().isBlank() || req.name().length() > 60) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_REQUEST", "주차장 이름을 적어 주세요.");
        }
        if (req.lat() == null || req.lng() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_COORD", "지도를 눌러 위치를 먼저 정해 주세요.");
        }
        checkCoords(req.lat(), req.lng());
        checkCapacity(req.capacity());
        Instant now = clock.instant();
        int order = lots.findAllByOrderBySortOrderAsc().stream().mapToInt(ParkingLot::getSortOrder).max().orElse(0) + 1;
        String code = "lot-" + Long.toString(now.toEpochMilli(), 36);
        ParkingLot lot = new ParkingLot(code, req.name().trim(),
                req.category() != null ? req.category() : ParkingLot.Category.NEAR,
                req.lat(), req.lng(), req.capacity(), order, now);
        lot.setShuttleStop(req.shuttleStop(), now);
        return view(lots.save(lot), null);
    }

    private static void checkCoords(double lat, double lng) {
        if (lat < 37.9 || lat > 38.35 || lng < 127.4 || lng > 128.0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_COORD", "화천군 안의 위치를 지도에서 골라 주세요.");
        }
    }

    private static void checkCapacity(Integer capacity) {
        if (capacity != null && (capacity < 0 || capacity > 5000)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_REQUEST", "면수는 0~5000 사이로 적어 주세요.");
        }
    }

    @Transactional
    public LotView adminUpdate(String code, AdminUpdate req) {
        ParkingLot lot = lots.lockByCode(code).orElseThrow(() -> ApiException.notFound("주차장"));
        Instant now = clock.instant();
        if (req.currentCount() != null) {
            lot.setCurrentCount(req.currentCount(), now);
        }
        if (req.delta() != null) {
            lot.applyDelta(req.delta(), now);
        }
        if (Boolean.TRUE.equals(req.clearOperableCapacity())) {
            lot.setOperableCapacity(null, now);
        } else if (req.operableCapacity() != null) {
            if (req.operableCapacity() < 0) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_REQUEST", "운영 가능 면수는 0 이상이어야 합니다.");
            }
            lot.setOperableCapacity(req.operableCapacity(), now);
        }
        if (req.manualStatus() != null) {
            lot.setManualStatus(req.manualStatus(), now);
        }
        if (req.name() != null) {
            if (req.name().isBlank() || req.name().length() > 60) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_REQUEST", "주차장 이름을 적어 주세요.");
            }
            lot.rename(req.name().trim(), now);
        }
        if (req.lat() != null || req.lng() != null) {
            double newLat = req.lat() != null ? req.lat() : lot.getLat();
            double newLng = req.lng() != null ? req.lng() : lot.getLng();
            checkCoords(newLat, newLng);
            lot.moveTo(newLat, newLng, now);
        }
        if (Boolean.TRUE.equals(req.clearCapacity())) {
            lot.setCapacity(null, now);
        } else if (req.capacity() != null) {
            checkCapacity(req.capacity());
            lot.setCapacity(req.capacity(), now);
        }
        if (req.category() != null) {
            lot.setCategory(req.category(), now);
        }
        if (req.shuttleStop() != null) {
            lot.setShuttleStop(req.shuttleStop(), now);
        }
        return view(lot, devices.lastSeenByLot().get(lot.getId()));
    }

    private LotView view(ParkingLot lot, Instant lastSeen) {
        boolean online = lastSeen != null
                && Duration.between(lastSeen, clock.instant()).toMinutes() < props.sensor().staleMinutes();
        return LotView.of(lot, lastSeen, online);
    }
}
