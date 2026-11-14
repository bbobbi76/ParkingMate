package kr.parkingmate.common;

import java.time.Clock;
import java.time.ZonedDateTime;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** 화면에 표시할 "몇 시 기준" 시각. 시연 시계(DEMO_CLOCK)와 맞추기 위해 서버 시각을 쓴다. */
@RestController
public class TimeController {

    private final Clock clock;

    public TimeController(Clock clock) {
        this.clock = clock;
    }

    @GetMapping("/api/now")
    public Map<String, String> now() {
        return Map.of("now", ZonedDateTime.now(clock).toOffsetDateTime().toString());
    }
}
