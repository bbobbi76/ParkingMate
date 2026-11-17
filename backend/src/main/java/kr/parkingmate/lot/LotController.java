package kr.parkingmate.lot;

import java.util.List;
import kr.parkingmate.common.KeyGuard;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class LotController {

    private final LotService service;
    private final KeyGuard guard;

    public LotController(LotService service, KeyGuard guard) {
        this.service = service;
        this.guard = guard;
    }

    @GetMapping("/lots")
    public List<LotView> list() {
        return service.list();
    }

    @GetMapping("/lots/{code}")
    public LotView get(@PathVariable String code) {
        return service.get(code);
    }

    @PostMapping("/admin/lots")
    @ResponseStatus(HttpStatus.CREATED)
    public LotView create(@RequestHeader(value = "X-Admin-Key", required = false) String key,
                          @RequestBody LotService.CreateLot body) {
        guard.requireAdmin(key);
        return service.create(body);
    }

    @PatchMapping("/admin/lots/{code}")
    public LotView update(@RequestHeader(value = "X-Admin-Key", required = false) String key,
                          @PathVariable String code, @RequestBody LotService.AdminUpdate body) {
        guard.requireAdmin(key);
        return service.adminUpdate(code, body);
    }
}
