package kr.parkingmate.common;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/** 관리자·센서 키 확인. 시연 규모에 맞춘 단순 공유 키 방식. */
@Component
public class KeyGuard {

    private final AppProperties props;

    public KeyGuard(AppProperties props) {
        this.props = props;
    }

    public void requireAdmin(String key) {
        if (!matches(props.adminKey(), key)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "ADMIN_KEY", "관리자 키가 올바르지 않습니다.");
        }
    }

    public void requireSensor(String key) {
        if (!matches(props.sensorKey(), key)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "SENSOR_KEY", "센서 키가 올바르지 않습니다.");
        }
    }

    private static boolean matches(String expected, String given) {
        if (expected == null || expected.isBlank() || given == null) {
            return false;
        }
        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8), given.getBytes(StandardCharsets.UTF_8));
    }
}
