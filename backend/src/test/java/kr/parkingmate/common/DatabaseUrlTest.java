package kr.parkingmate.common;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import org.junit.jupiter.api.Test;

class DatabaseUrlTest {

    @Test
    void convertsNeonStyleUrl() {
        Map<String, String> p = DatabaseUrl.toSpringProperties(
                "postgresql://neondb_owner:p%40ss@ep-cool-1.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require");
        assertEquals("jdbc:postgresql://ep-cool-1.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
                p.get("spring.datasource.url"));
        assertEquals("neondb_owner", p.get("spring.datasource.username"));
        assertEquals("p@ss", p.get("spring.datasource.password"));
    }

    @Test
    void keepsPortAndLeavesJdbcAlone() {
        assertEquals("jdbc:postgresql://db:5432/app",
                DatabaseUrl.toSpringProperties("postgres://u:p@db:5432/app").get("spring.datasource.url"));
        assertTrue(DatabaseUrl.toSpringProperties("jdbc:postgresql://x/y").isEmpty());
        assertTrue(DatabaseUrl.toSpringProperties(null).isEmpty());
    }
}
