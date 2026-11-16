package kr.parkingmate.sensor;

import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import kr.parkingmate.common.ApiException;
import kr.parkingmate.common.AppProperties;
import kr.parkingmate.lot.ParkingLot;
import kr.parkingmate.lot.ParkingLotRepository;
import org.springframework.data.domain.Limit;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SensorService {

    public record EventIn(String deviceId, Long seq, String direction, OffsetDateTime occurredAt) {}

    public record Result(int accepted, int duplicates, List<String> errors) {}

    public record EventView(String deviceId, long seq, String direction, Instant occurredAt, boolean voucherLinked) {}

    /** 장치별 연결 상태. online = 최근 staleMinutes 안에 이벤트나 heartbeat가 있었음. */
    public record DeviceView(String deviceId, String gate, Instant lastSeenAt, Long lastSeq, boolean online) {}

    private final SensorDeviceRepository devices;
    private final VehicleEventRepository events;
    private final ParkingLotRepository lots;
    private final Clock clock;
    private final AppProperties props;

    public SensorService(SensorDeviceRepository devices, VehicleEventRepository events,
                         ParkingLotRepository lots, Clock clock, AppProperties props) {
        this.devices = devices;
        this.events = events;
        this.lots = lots;
        this.clock = clock;
        this.props = props;
    }

    @Transactional(readOnly = true)
    public List<DeviceView> devices(String lotCode) {
        ParkingLot lot = lots.findByCode(lotCode).orElseThrow(() -> ApiException.notFound("주차장"));
        Instant now = clock.instant();
        return devices.findByLotId(lot.getId()).stream()
                .sorted(java.util.Comparator.comparing(SensorDevice::getGate))
                .map(d -> new DeviceView(d.getDeviceId(), d.getGate().name(), d.getLastSeenAt(), d.getLastSeq(),
                        d.getLastSeenAt() != null
                                && java.time.Duration.between(d.getLastSeenAt(), now).toMinutes()
                                        < props.sensor().staleMinutes()))
                .toList();
    }

    /**
     * 센서 이벤트를 반영한다. 같은 deviceId+seq는 한 번만 센다(브리지가 재전송해도 안전).
     * occurredAt이 없으면 서버 수신 시각을 쓴다.
     */
    @Transactional
    public Result ingest(List<EventIn> batch) {
        int accepted = 0;
        int duplicates = 0;
        List<String> errors = new ArrayList<>();
        Instant now = clock.instant();
        for (EventIn in : batch) {
            if (in == null || in.deviceId() == null || in.seq() == null || in.direction() == null) {
                errors.add("필수 값(deviceId, seq, direction)이 없습니다.");
                continue;
            }
            SensorDevice device = devices.findByDeviceId(in.deviceId()).orElse(null);
            if (device == null) {
                errors.add(in.deviceId() + ": 등록되지 않은 센서");
                continue;
            }
            VehicleEvent.Direction dir;
            try {
                dir = VehicleEvent.Direction.valueOf(in.direction().trim().toUpperCase());
            } catch (IllegalArgumentException e) {
                errors.add(in.deviceId() + "#" + in.seq() + ": direction은 IN 또는 OUT");
                continue;
            }
            device.seen(in.seq(), now);
            if (events.existsByDeviceIdAndSeq(in.deviceId(), in.seq())) {
                duplicates++;
                continue;
            }
            // 장치 시계가 안 맞거나(±10분 초과) 시각이 없으면 서버 수신 시각을 쓴다.
            Instant at = now;
            if (in.occurredAt() != null) {
                Instant dev = in.occurredAt().toInstant();
                if (Math.abs(java.time.Duration.between(dev, now).toMinutes()) <= 10) {
                    at = dev;
                }
            }
            events.save(new VehicleEvent(in.deviceId(), device.getLotId(), dir, in.seq(), at, now));
            ParkingLot lot = lots.lockById(device.getLotId()).orElseThrow();
            lot.applyDelta(dir == VehicleEvent.Direction.IN ? 1 : -1, now);
            accepted++;
        }
        return new Result(accepted, duplicates, errors);
    }

    /** 이벤트 없이 센서 연결 상태만 알리는 신호. */
    @Transactional
    public void heartbeat(String deviceId) {
        SensorDevice device = devices.findByDeviceId(deviceId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "등록되지 않은 센서입니다."));
        device.seen(null, clock.instant());
    }

    @Transactional(readOnly = true)
    public List<EventView> recent(String lotCode, int limit) {
        ParkingLot lot = lots.findByCode(lotCode).orElseThrow(() -> ApiException.notFound("주차장"));
        return events.findByLotIdOrderByOccurredAtDesc(lot.getId(), Limit.of(Math.min(limit, 200))).stream()
                .map(e -> new EventView(e.getDeviceId(), e.getSeq(), e.getDirection().name(),
                        e.getOccurredAt(), e.getVoucherId() != null))
                .toList();
    }
}
