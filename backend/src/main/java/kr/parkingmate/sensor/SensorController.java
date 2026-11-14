package kr.parkingmate.sensor;

import java.util.List;
import java.util.Map;
import kr.parkingmate.common.KeyGuard;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class SensorController {

    public record Batch(List<SensorService.EventIn> events) {}

    private final SensorService service;
    private final KeyGuard guard;

    public SensorController(SensorService service, KeyGuard guard) {
        this.service = service;
        this.guard = guard;
    }

    @PostMapping("/sensor/events")
    public SensorService.Result ingest(@RequestHeader(value = "X-Sensor-Key", required = false) String key,
                                       @RequestBody Batch body) {
        guard.requireSensor(key);
        return service.ingest(body.events() == null ? List.of() : body.events());
    }

    @PostMapping("/sensor/heartbeat")
    public Map<String, String> heartbeat(@RequestHeader(value = "X-Sensor-Key", required = false) String key,
                                         @RequestBody Map<String, String> body) {
        guard.requireSensor(key);
        service.heartbeat(body.get("deviceId"));
        return Map.of("status", "ok");
    }

    @GetMapping("/admin/lots/{code}/events")
    public List<SensorService.EventView> recent(@RequestHeader(value = "X-Admin-Key", required = false) String key,
                                                @PathVariable String code,
                                                @RequestParam(defaultValue = "30") int limit) {
        guard.requireAdmin(key);
        return service.recent(code, limit);
    }
}
