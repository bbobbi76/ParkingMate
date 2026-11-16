package kr.parkingmate.common;

import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.util.Map;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

/**
 * 시연 초기화: 리허설에서 쌓인 센서 기록을 지우고 센서 주차장 차량 수를 시연 시작값으로 돌린다.
 */
@RestController
public class DemoResetController {

    private static final int WIRARI_START_COUNT = 188;

    private final EntityManager em;
    private final KeyGuard guard;
    private final Clock clock;

    public DemoResetController(EntityManager em, KeyGuard guard, Clock clock) {
        this.em = em;
        this.guard = guard;
        this.clock = clock;
    }

    @PostMapping("/api/admin/demo/reset")
    @Transactional
    public Map<String, Integer> reset(@RequestHeader(value = "X-Admin-Key", required = false) String key) {
        guard.requireAdmin(key);
        int events = em.createQuery("delete from VehicleEvent").executeUpdate();
        // 센서가 실제로 붙은 주차장(발표 장소 평생학습관)은 빈 상태 0대 → 남은 자리가 면수 그대로(50)
        em.createQuery("update ParkingLot l set l.currentCount = 0, l.updatedAt = :t "
                        + "where l.id in (select d.lotId from SensorDevice d)")
                .setParameter("t", clock.instant())
                .executeUpdate();
        // 위라리 둔치는 시연 상황(토요일 오전) 값으로
        em.createQuery("update ParkingLot l set l.currentCount = :c, l.updatedAt = :t where l.code = 'wirari'")
                .setParameter("c", WIRARI_START_COUNT)
                .setParameter("t", clock.instant())
                .executeUpdate();
        return Map.of("deletedEvents", events);
    }
}
