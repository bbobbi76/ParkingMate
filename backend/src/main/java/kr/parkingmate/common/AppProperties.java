package kr.parkingmate.common;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app")
public record AppProperties(
        String adminKey,
        /** true면 관리 API 키 확인을 하지 않음 (시연 기간용). */
        boolean adminOpen,
        String sensorKey,
        List<String> allowedOrigins,
        String zone,
        String demoClock,
        /** true 면 셔틀을 매일·항상 운행 중으로 계산(시연용). 실제 운행표는 토·일 09~18시. */
        boolean shuttleAlways,
        Sensor sensor) {

    public record Sensor(int staleMinutes) {}
}
