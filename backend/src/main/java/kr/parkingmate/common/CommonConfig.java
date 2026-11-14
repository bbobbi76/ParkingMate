package kr.parkingmate.common;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CommonConfig implements WebMvcConfigurer {

    private final AppProperties props;

    public CommonConfig(AppProperties props) {
        this.props = props;
    }

    /**
     * 시연 때는 DEMO_CLOCK(예: 2027-01-16T09:30)으로 서버 시작 시각을 축제 날짜로 옮긴다.
     * 시계는 멈추지 않고 실제 시간만큼 흘러간다.
     */
    @Bean
    public Clock clock() {
        ZoneId zone = ZoneId.of(props.zone());
        Clock system = Clock.system(zone);
        String demo = props.demoClock();
        if (demo != null && !demo.isBlank()) {
            Duration shift = Duration.between(system.instant(), LocalDateTime.parse(demo).atZone(zone).toInstant());
            return Clock.offset(system, shift);
        }
        return system;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(props.allowedOrigins().toArray(String[]::new))
                .allowedMethods("GET", "POST", "PATCH", "OPTIONS")
                .allowedHeaders("*");
    }
}
