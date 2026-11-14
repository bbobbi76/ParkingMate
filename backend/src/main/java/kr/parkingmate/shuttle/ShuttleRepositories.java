package kr.parkingmate.shuttle;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface ShuttleRouteRepository extends JpaRepository<ShuttleRoute, Long> {}

interface ShuttleStopRepository extends JpaRepository<ShuttleStop, Long> {
    List<ShuttleStop> findByRouteIdOrderBySeqAsc(Long routeId);
}
