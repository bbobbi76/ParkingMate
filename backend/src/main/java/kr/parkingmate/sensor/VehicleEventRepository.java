package kr.parkingmate.sensor;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface VehicleEventRepository extends JpaRepository<VehicleEvent, Long> {

    boolean existsByDeviceIdAndSeq(String deviceId, long seq);

    List<VehicleEvent> findByLotIdOrderByOccurredAtDesc(Long lotId, Limit limit);

    /** 아직 이용권과 짝지어지지 않은 가장 오래된 입차(시간 범위 안). */
    @Query("""
            select e from VehicleEvent e
            where e.lotId = :lotId and e.direction = kr.parkingmate.sensor.VehicleEvent.Direction.IN
              and e.voucherId is null and e.occurredAt >= :since
            order by e.occurredAt asc
            """)
    List<VehicleEvent> unclaimedEntries(Long lotId, Instant since, Limit limit);

    default Optional<VehicleEvent> oldestUnclaimedEntry(Long lotId, Instant since) {
        return unclaimedEntries(lotId, since, Limit.of(1)).stream().findFirst();
    }

    long countByLotIdAndDirectionAndOccurredAtGreaterThanEqual(Long lotId, VehicleEvent.Direction direction, Instant since);

    long countByDirectionAndOccurredAtGreaterThanEqual(VehicleEvent.Direction direction, Instant since);
}
