package kr.parkingmate.common;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Neon·Render 등이 주는 "postgresql://사용자:비밀번호@호스트/DB?sslmode=require" 형식을
 * Spring이 쓰는 JDBC 형식으로 바꾼다. 이미 jdbc: 로 시작하면 그대로 둔다.
 */
public final class DatabaseUrl {

    private DatabaseUrl() {}

    /** 반환: spring.datasource.url / username / password. 바꿀 필요가 없으면 빈 Map. */
    public static Map<String, String> toSpringProperties(String raw) {
        Map<String, String> out = new LinkedHashMap<>();
        if (raw == null || raw.isBlank()) {
            return out;
        }
        String s = raw.trim();
        if (!(s.startsWith("postgres://") || s.startsWith("postgresql://"))) {
            return out;
        }
        URI uri = URI.create(s.replaceFirst("^postgres(ql)?://", "http://"));
        String query = uri.getRawQuery();
        StringBuilder jdbc = new StringBuilder("jdbc:postgresql://").append(uri.getHost());
        if (uri.getPort() > 0) {
            jdbc.append(':').append(uri.getPort());
        }
        jdbc.append(uri.getRawPath());
        if (query != null && !query.isBlank()) {
            jdbc.append('?').append(query);
        }
        out.put("spring.datasource.url", jdbc.toString());
        String userInfo = uri.getRawUserInfo();
        if (userInfo != null) {
            int i = userInfo.indexOf(':');
            String user = i < 0 ? userInfo : userInfo.substring(0, i);
            out.put("spring.datasource.username", URLDecoder.decode(user, StandardCharsets.UTF_8));
            if (i >= 0) {
                out.put("spring.datasource.password", URLDecoder.decode(userInfo.substring(i + 1), StandardCharsets.UTF_8));
            }
        }
        return out;
    }
}
