package kr.parkingmate.voucher;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "voucher")
public class Voucher {

    public enum Channel { SELF, STAFF }

    public enum Status { ISSUED, REDEEMED, VOID }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String code;
    private Long lotId;
    private Long benefitId;
    private String plateNumber;
    private LocalDate festivalDate;

    @Enumerated(EnumType.STRING)
    private Channel channel;

    @Enumerated(EnumType.STRING)
    private Status status;

    private Instant issuedAt;
    private Instant redeemedAt;

    protected Voucher() {}

    public Voucher(String code, Long lotId, Long benefitId, String plateNumber, LocalDate festivalDate,
                   Channel channel, Instant issuedAt) {
        this.code = code;
        this.lotId = lotId;
        this.benefitId = benefitId;
        this.plateNumber = plateNumber;
        this.festivalDate = festivalDate;
        this.channel = channel;
        this.status = Status.ISSUED;
        this.issuedAt = issuedAt;
    }

    public void redeem(Instant at) {
        this.status = Status.REDEEMED;
        this.redeemedAt = at;
    }

    public Long getId() { return id; }
    public String getCode() { return code; }
    public Long getLotId() { return lotId; }
    public Long getBenefitId() { return benefitId; }
    public String getPlateNumber() { return plateNumber; }
    public LocalDate getFestivalDate() { return festivalDate; }
    public Channel getChannel() { return channel; }
    public Status getStatus() { return status; }
    public Instant getIssuedAt() { return issuedAt; }
    public Instant getRedeemedAt() { return redeemedAt; }
}
