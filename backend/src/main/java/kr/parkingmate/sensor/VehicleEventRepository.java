package kr.parkingmate.sensor;

import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VehicleEventRepository extends JpaRepository<VehicleEvent, Long> {

    boolean existsByDeviceIdAndSeq(String deviceId, long seq);

    List<VehicleEvent> findByLotIdOrderByOccurredAtDesc(Long lotId, Limit limit);

    long countByLotIdAndDirectionAndOccurredAtGreaterThanEqual(Long lotId, VehicleEvent.Direction direction, Instant since);

    long countByDirectionAndOccurredAtGreaterThanEqual(VehicleEvent.Direction direction, Instant since);
}
