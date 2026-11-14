package kr.parkingmate.sensor;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SensorDeviceRepository extends JpaRepository<SensorDevice, Long> {

    Optional<SensorDevice> findByDeviceId(String deviceId);

    List<SensorDevice> findByLotId(Long lotId);

    /** 주차장별로 가장 최근에 신호를 보낸 센서 시각. */
    default Map<Long, Instant> lastSeenByLot() {
        Map<Long, Instant> map = new HashMap<>();
        for (SensorDevice d : findAll()) {
            if (d.getLastSeenAt() != null) {
                map.merge(d.getLotId(), d.getLastSeenAt(), (a, b) -> a.isAfter(b) ? a : b);
            }
        }
        return map;
    }
}
