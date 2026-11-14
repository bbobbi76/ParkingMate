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
                              Boolean clearOperableCapacity, ParkingLot.ManualStatus manualStatus) {}

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
        return view(lot, devices.lastSeenByLot().get(lot.getId()));
    }

    private LotView view(ParkingLot lot, Instant lastSeen) {
        boolean online = lastSeen != null
                && Duration.between(lastSeen, clock.instant()).toMinutes() < props.sensor().staleMinutes();
        return LotView.of(lot, lastSeen, online);
    }
}
