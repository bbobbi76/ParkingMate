package kr.parkingmate.voucher;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import kr.parkingmate.common.KeyGuard;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class VoucherController {

    public record IssueRequest(@NotBlank String lotCode, @NotBlank String plateNumber) {}

    public record BenefitView(String name, String description, boolean example) {}

    private final VoucherService service;
    private final KeyGuard guard;

    public VoucherController(VoucherService service, KeyGuard guard) {
        this.service = service;
        this.guard = guard;
    }

    @GetMapping("/benefits")
    public List<BenefitView> benefits() {
        return service.activeBenefits().stream()
                .map(b -> new BenefitView(b.getName(), b.getDescription(), b.isExample())).toList();
    }

    @PostMapping("/vouchers")
    @ResponseStatus(HttpStatus.CREATED)
    public VoucherService.VoucherView issue(@Valid @RequestBody IssueRequest req) {
        return service.issue(req.lotCode(), req.plateNumber(), Voucher.Channel.SELF);
    }

    @GetMapping("/vouchers/{code}")
    public VoucherService.VoucherView get(@PathVariable String code) {
        return service.get(code);
    }

    @PostMapping("/admin/vouchers")
    @ResponseStatus(HttpStatus.CREATED)
    public VoucherService.VoucherView staffIssue(@RequestHeader(value = "X-Admin-Key", required = false) String key,
                                                 @Valid @RequestBody IssueRequest req) {
        guard.requireAdmin(key);
        return service.issue(req.lotCode(), req.plateNumber(), Voucher.Channel.STAFF);
    }

    @GetMapping("/admin/vouchers")
    public VoucherService.VoucherView byPlate(@RequestHeader(value = "X-Admin-Key", required = false) String key,
                                              @RequestParam String plate) {
        guard.requireAdmin(key);
        return service.findByPlate(plate);
    }

    @PostMapping("/admin/vouchers/{code}/redeem")
    public VoucherService.VoucherView redeem(@RequestHeader(value = "X-Admin-Key", required = false) String key,
                                             @PathVariable String code) {
        guard.requireAdmin(key);
        return service.redeem(code);
    }

    @GetMapping("/admin/summary")
    public VoucherService.Summary summary(@RequestHeader(value = "X-Admin-Key", required = false) String key) {
        guard.requireAdmin(key);
        return service.summary();
    }
}
