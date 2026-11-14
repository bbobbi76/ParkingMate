package kr.parkingmate.voucher;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import kr.parkingmate.common.ApiException;
import kr.parkingmate.common.AppProperties;
import kr.parkingmate.lot.ParkingLot;
import kr.parkingmate.lot.ParkingLotRepository;
import kr.parkingmate.sensor.VehicleEvent;
import kr.parkingmate.sensor.VehicleEventRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class VoucherService {

    public record VoucherView(String code, String status, String channel, String plateNumber,
                              LocalDate festivalDate, Instant issuedAt, Instant redeemedAt,
                              String lotCode, String lotName, String benefitName, String benefitDescription,
                              boolean benefitIsExample, boolean sensorVerified) {}

    public record Summary(LocalDate date, long issued, long redeemed, long entriesToday, long exitsToday,
                          List<LotCount> byLot) {}

    public record LotCount(String code, String name, long issued) {}

    private static final String ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    private final SecureRandom random = new SecureRandom();

    private final VoucherRepository vouchers;
    private final BenefitRepository benefits;
    private final ParkingLotRepository lots;
    private final VehicleEventRepository events;
    private final AppProperties props;
    private final Clock clock;

    VoucherService(VoucherRepository vouchers, BenefitRepository benefits, ParkingLotRepository lots,
                   VehicleEventRepository events, AppProperties props, Clock clock) {
        this.vouchers = vouchers;
        this.benefits = benefits;
        this.lots = lots;
        this.events = events;
        this.props = props;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<Benefit> activeBenefits() {
        return benefits.findByActiveTrueOrderByIdAsc();
    }

    /**
     * 이용권 발급.
     * - 혜택 대상 주차장만, 차량번호당 하루 1장.
     * - 센서가 있는 주차장은 최근 입차 기록 1건과 짝지어야 발급(방문객 직접 발급 시 필수, 직원 발급은 있으면 짝지음).
     */
    @Transactional
    public VoucherView issue(String lotCode, String rawPlate, Voucher.Channel channel) {
        ParkingLot lot = lots.lockByCode(lotCode).orElseThrow(() -> ApiException.notFound("주차장"));
        if (!lot.isIncentive()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "NOT_INCENTIVE", "이 주차장은 이용권 대상이 아닙니다.");
        }
        if (lot.getManualStatus() == ParkingLot.ManualStatus.CLOSED) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "CLOSED", "지금은 운영하지 않는 주차장입니다.");
        }
        String plate = PlateNumber.normalize(rawPlate);
        Instant now = clock.instant();
        LocalDate today = LocalDate.now(clock);
        if (vouchers.findByPlateNumberAndFestivalDate(plate, today).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "ALREADY_ISSUED",
                    "오늘 이 차량으로 이미 이용권을 받으셨어요. 안내소에서 차량번호로 확인해 드립니다.");
        }
        Benefit benefit = benefits.findByActiveTrueOrderByIdAsc().stream().findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "NO_BENEFIT", "지금은 이용권을 드릴 수 없습니다."));

        Optional<VehicleEvent> entry = Optional.empty();
        if (lot.isSensorEnabled()) {
            Instant since = now.minus(props.voucher().sensorWindowMinutes(), ChronoUnit.MINUTES);
            entry = events.oldestUnclaimedEntry(lot.getId(), since);
            if (entry.isEmpty() && channel == Voucher.Channel.SELF) {
                throw new ApiException(HttpStatus.CONFLICT, "NO_ENTRY",
                        "입차 확인이 아직 안 됐어요. 주차장 직원에게 말씀해 주시면 바로 발급해 드립니다.");
            }
        }

        Voucher v = vouchers.save(new Voucher(newCode(), lot.getId(), benefit.getId(), plate, today, channel, now));
        entry.ifPresent(e -> e.claimBy(v.getId()));
        return view(v, lot, benefit, entry.isPresent());
    }

    @Transactional(readOnly = true)
    public VoucherView get(String code) {
        Voucher v = vouchers.findByCode(code.trim().toUpperCase()).orElseThrow(() -> ApiException.notFound("이용권"));
        return view(v);
    }

    @Transactional(readOnly = true)
    public VoucherView findByPlate(String rawPlate) {
        String plate = PlateNumber.normalize(rawPlate);
        Voucher v = vouchers.findByPlateNumberAndFestivalDate(plate, LocalDate.now(clock))
                .orElseThrow(() -> ApiException.notFound("오늘 발급된 이용권"));
        return view(v);
    }

    @Transactional
    public VoucherView redeem(String code) {
        Voucher v = vouchers.findByCode(code.trim().toUpperCase()).orElseThrow(() -> ApiException.notFound("이용권"));
        if (v.getStatus() == Voucher.Status.REDEEMED) {
            throw new ApiException(HttpStatus.CONFLICT, "ALREADY_REDEEMED", "이미 사용한 이용권입니다.");
        }
        if (v.getStatus() == Voucher.Status.VOID) {
            throw new ApiException(HttpStatus.CONFLICT, "VOID", "취소된 이용권입니다.");
        }
        if (!v.getFestivalDate().equals(LocalDate.now(clock))) {
            throw new ApiException(HttpStatus.CONFLICT, "EXPIRED", "발급 당일에만 사용할 수 있는 이용권입니다.");
        }
        v.redeem(clock.instant());
        return view(v);
    }

    @Transactional(readOnly = true)
    public Summary summary() {
        LocalDate today = LocalDate.now(clock);
        Instant start = today.atStartOfDay(clock.getZone()).toInstant();
        List<LotCount> byLot = lots.findAllByOrderBySortOrderAsc().stream()
                .filter(ParkingLot::isIncentive)
                .map(l -> new LotCount(l.getCode(), l.getName(), vouchers.countByFestivalDateAndLotId(today, l.getId())))
                .toList();
        return new Summary(today,
                vouchers.countByFestivalDate(today),
                vouchers.countByFestivalDateAndStatus(today, Voucher.Status.REDEEMED),
                events.countByDirectionAndOccurredAtGreaterThanEqual(VehicleEvent.Direction.IN, start),
                events.countByDirectionAndOccurredAtGreaterThanEqual(VehicleEvent.Direction.OUT, start),
                byLot);
    }

    private VoucherView view(Voucher v) {
        ParkingLot lot = lots.findById(v.getLotId()).orElseThrow();
        Benefit b = benefits.findById(v.getBenefitId()).orElseThrow();
        return view(v, lot, b, false);
    }

    private VoucherView view(Voucher v, ParkingLot lot, Benefit b, boolean sensorVerified) {
        return new VoucherView(v.getCode(), v.getStatus().name(), v.getChannel().name(), v.getPlateNumber(),
                v.getFestivalDate(), v.getIssuedAt(), v.getRedeemedAt(), lot.getCode(), lot.getName(),
                b.getName(), b.getDescription(), b.isExample(), sensorVerified);
    }

    private String newCode() {
        for (int attempt = 0; attempt < 10; attempt++) {
            StringBuilder sb = new StringBuilder(6);
            for (int i = 0; i < 6; i++) {
                sb.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
            }
            if (!vouchers.existsByCode(sb.toString())) {
                return sb.toString();
            }
        }
        throw new IllegalStateException("이용권 코드 생성 실패");
    }
}
