package kr.parkingmate.common;

import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.util.Map;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

/**
 * 시연 초기화: 리허설에서 쓴 이용권·센서 기록을 지우고 센서 주차장 차량 수를 시연 시작값으로 돌린다.
 * 이용권은 차량번호당 하루 1장이라, 리허설에 쓴 번호를 발표 때 다시 쓰려면 필요하다.
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
        int vouchers = em.createQuery("delete from Voucher").executeUpdate();
        em.createQuery("update ParkingLot l set l.currentCount = :c, l.updatedAt = :t where l.sensorEnabled = true")
                .setParameter("c", WIRARI_START_COUNT)
                .setParameter("t", clock.instant())
                .executeUpdate();
        return Map.of("deletedEvents", events, "deletedVouchers", vouchers);
    }
}
