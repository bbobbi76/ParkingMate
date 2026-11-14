package kr.parkingmate.voucher;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

interface BenefitRepository extends JpaRepository<Benefit, Long> {
    List<Benefit> findByActiveTrueOrderByIdAsc();
}

interface VoucherRepository extends JpaRepository<Voucher, Long> {
    Optional<Voucher> findByCode(String code);

    Optional<Voucher> findByPlateNumberAndFestivalDate(String plateNumber, LocalDate festivalDate);

    boolean existsByCode(String code);

    long countByFestivalDate(LocalDate date);

    long countByFestivalDateAndStatus(LocalDate date, Voucher.Status status);

    long countByFestivalDateAndLotId(LocalDate date, Long lotId);
}
