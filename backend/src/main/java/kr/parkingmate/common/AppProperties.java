package kr.parkingmate.common;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app")
public record AppProperties(
        String adminKey,
        String sensorKey,
        List<String> allowedOrigins,
        String zone,
        String demoClock,
        Voucher voucher,
        Sensor sensor) {

    public record Voucher(int sensorWindowMinutes) {}

    public record Sensor(int staleMinutes) {}
}
