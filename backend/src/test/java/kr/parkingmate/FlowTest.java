package kr.parkingmate;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_EACH_TEST_METHOD)
class FlowTest {

    @Autowired
    MockMvc mvc;

    private void sensor(String body) throws Exception {
        mvc.perform(post("/api/sensor/events").header("X-Sensor-Key", "test-sensor")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());
    }

    @Test
    void seedLotsAreListedWithUnknownCapacityKeptNull() throws Exception {
        mvc.perform(get("/api/lots"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(12)))
                .andExpect(jsonPath("$[0].code", is("wirari")))
                .andExpect(jsonPath("$[0].remaining", is(500)))
                .andExpect(jsonPath("$[1].capacity", nullValue()))
                .andExpect(jsonPath("$[1].level", is("UNKNOWN")));
    }

    @Test
    void sensorEventsCountOnceAndChangeRemaining() throws Exception {
        String batch = """
                {"events":[
                  {"deviceId":"entry-stm32","seq":1,"direction":"IN"},
                  {"deviceId":"entry-stm32","seq":2,"direction":"IN"},
                  {"deviceId":"exit-pico","seq":1,"direction":"OUT"}]}""";
        sensor(batch);
        sensor(batch); // 재전송은 중복으로 무시
        mvc.perform(get("/api/lots/wirari"))
                .andExpect(jsonPath("$.currentCount", is(1)))
                .andExpect(jsonPath("$.remaining", is(499)))
                .andExpect(jsonPath("$.sensorOnline", is(true)));
    }

    @Test
    void wrongSensorKeyIsRejected() throws Exception {
        mvc.perform(post("/api/sensor/events").header("X-Sensor-Key", "nope")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"events\":[]}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void adminSeesPerDeviceStatusAndTodayCounts() throws Exception {
        sensor("{\"events\":[{\"deviceId\":\"entry-stm32\",\"seq\":10,\"direction\":\"IN\"}]}");
        mvc.perform(get("/api/admin/lots/wirari/sensors").header("X-Admin-Key", "test-admin"))
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].gate", is("ENTRY")))
                .andExpect(jsonPath("$[0].online", is(true)))
                .andExpect(jsonPath("$[1].gate", is("EXIT")))
                .andExpect(jsonPath("$[1].online", is(false)));
        mvc.perform(get("/api/admin/summary").header("X-Admin-Key", "test-admin"))
                .andExpect(jsonPath("$.entriesToday", is(1)))
                .andExpect(jsonPath("$.exitsToday", is(0)));
    }

    @Test
    void voucherApiIsGone() throws Exception {
        mvc.perform(post("/api/vouchers").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lotCode\":\"wirari\",\"plateNumber\":\"12가3456\"}"))
                .andExpect(status().is4xxClientError());
        mvc.perform(get("/api/lots/wirari")).andExpect(jsonPath("$.incentive").doesNotExist());
    }

    @Test
    void adminCanReduceCapacityForSnowAndSetStatus() throws Exception {
        mvc.perform(patch("/api/admin/lots/wirari").header("X-Admin-Key", "test-admin")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"operableCapacity\":300,\"currentCount\":250}"))
                .andExpect(jsonPath("$.remaining", is(50)))
                .andExpect(jsonPath("$.level", is("BUSY")));
        mvc.perform(patch("/api/admin/lots/info-hs").header("X-Admin-Key", "test-admin")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"manualStatus\":\"FULL\"}"))
                .andExpect(jsonPath("$.level", is("FULL")));
        mvc.perform(patch("/api/admin/lots/info-hs").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void demoResetClearsSensorEventsAndRestoresStartCount() throws Exception {
        sensor("{\"events\":[{\"deviceId\":\"entry-stm32\",\"seq\":1,\"direction\":\"IN\"}]}");
        mvc.perform(post("/api/admin/demo/reset").header("X-Admin-Key", "test-admin"))
                .andExpect(jsonPath("$.deletedEvents", is(1)));
        mvc.perform(get("/api/lots/wirari")).andExpect(jsonPath("$.currentCount", is(188)));
        // 초기화 뒤 같은 seq 를 다시 보내도 새로 센다(기록이 지워졌으므로)
        sensor("{\"events\":[{\"deviceId\":\"entry-stm32\",\"seq\":1,\"direction\":\"IN\"}]}");
        mvc.perform(get("/api/lots/wirari")).andExpect(jsonPath("$.currentCount", is(189)));
    }

    @Test
    void adminIsLockedByDefault() throws Exception {
        mvc.perform(get("/api/admin/summary")).andExpect(status().isUnauthorized());
    }

    @Test
    void shuttleShowsSaturdayTimes() throws Exception {
        // 시연 시계 2027-01-16(토) 09:59부터 흐름
        mvc.perform(get("/api/shuttle"))
                .andExpect(jsonPath("$[0].runningNow", is(true)))
                .andExpect(jsonPath("$[0].stops", hasSize(7)))
                .andExpect(jsonPath("$[0].stops[0].next[0]", is("10:00:00")))
                .andExpect(jsonPath("$[0].stops[1].next[0]", is("10:10:00")));
    }
}
