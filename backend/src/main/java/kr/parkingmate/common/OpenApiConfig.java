package kr.parkingmate.common;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** API 명세서: /swagger-ui.html (노션 "API 명세서 배포 도메인") */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI parkingMateApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("산천어축제 주차안내 API")
                        .version("0.1.0")
                        .description("""
                                임시주차장 현황·센서 입출차·셔틀·무료이용권 API.
                                관리 API는 X-Admin-Key, 센서 API는 X-Sensor-Key 헤더가 필요합니다.
                                주차장 위치·셔틀은 2026 축제 공식 안내 기준, 면수 일부와 이용권 종류는 확인 중입니다."""))
                .components(new Components()
                        .addSecuritySchemes("admin", new SecurityScheme().type(SecurityScheme.Type.APIKEY)
                                .in(SecurityScheme.In.HEADER).name("X-Admin-Key"))
                        .addSecuritySchemes("sensor", new SecurityScheme().type(SecurityScheme.Type.APIKEY)
                                .in(SecurityScheme.In.HEADER).name("X-Sensor-Key")));
    }
}
