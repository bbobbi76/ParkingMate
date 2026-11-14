package kr.parkingmate;

import kr.parkingmate.common.DatabaseUrl;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class ParkingMateApplication {
    public static void main(String[] args) {
        // DATABASE_URL 이 postgresql://... 형식이어도 동작하도록 JDBC 형식으로 변환
        DatabaseUrl.toSpringProperties(System.getenv("DATABASE_URL")).forEach(System::setProperty);
        SpringApplication.run(ParkingMateApplication.class, args);
    }
}
