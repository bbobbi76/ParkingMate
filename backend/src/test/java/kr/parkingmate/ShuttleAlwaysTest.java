package kr.parkingmate;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/** SHUTTLE_ALWAYS=true: 운행표에 없는 평일 오후에도 셔틀이 도는 것으로 계산 (시연용). */
@SpringBootTest(properties = {"app.shuttle-always=true", "app.demo-clock=2026-11-16T16:30"})
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ShuttleAlwaysTest {

    @Autowired
    MockMvc mvc;

    @Test
    void runsOnWeekdayAfternoon() throws Exception {
        // 2026-11-16 은 월요일. 20분 간격, 한 바퀴 70분 → 16:30 에는 15:40·16:00·16:20 출발 버스 3대
        // (15:20 출발 버스는 막 한 바퀴를 마침)
        mvc.perform(get("/api/shuttle"))
                .andExpect(jsonPath("$[0].always", is(true)))
                .andExpect(jsonPath("$[0].runningNow", is(true)))
                .andExpect(jsonPath("$[0].serviceToday", is(true)))
                .andExpect(jsonPath("$[0].buses", hasSize(3)))
                .andExpect(jsonPath("$[0].stops[0].next[0]", is("16:40:00")))
                // 화면에 보이는 공식 운행표는 그대로
                .andExpect(jsonPath("$[0].firstDeparture", is("09:00:00")));
    }
}
