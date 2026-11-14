package kr.parkingmate.lot;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface ParkingLotRepository extends JpaRepository<ParkingLot, Long> {

    List<ParkingLot> findAllByOrderBySortOrderAsc();

    Optional<ParkingLot> findByCode(String code);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select l from ParkingLot l where l.id = :id")
    Optional<ParkingLot> lockById(Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select l from ParkingLot l where l.code = :code")
    Optional<ParkingLot> lockByCode(String code);
}
