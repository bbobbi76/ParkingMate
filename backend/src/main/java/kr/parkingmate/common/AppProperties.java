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
        Voucher voucher,
        Sensor sensor) {

    public record Voucher(int sensorWindowMinutes) {}

    public record Sensor(int staleMinutes) {}
}
