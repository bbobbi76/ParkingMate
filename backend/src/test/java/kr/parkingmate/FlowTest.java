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
import org.springframework.test.web.servlet.MvcResult;

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
    void voucherNeedsSensorEntryAndIsOnePerPlatePerDay() throws Exception {
        String req = "{\"lotCode\":\"wirari\",\"plateNumber\":\"12가 3456\"}";
        // 입차 기록 없으면 방문객 발급 불가
        mvc.perform(post("/api/vouchers").contentType(MediaType.APPLICATION_JSON).content(req))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code", is("NO_ENTRY")));

        sensor("{\"events\":[{\"deviceId\":\"entry-stm32\",\"seq\":10,\"direction\":\"IN\"}]}");

        MvcResult issued = mvc.perform(post("/api/vouchers").contentType(MediaType.APPLICATION_JSON).content(req))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.plateNumber", is("12가3456")))
                .andExpect(jsonPath("$.sensorVerified", is(true)))
                .andReturn();
        String code = issued.getResponse().getContentAsString().replaceAll(".*\"code\":\"([A-Z0-9]+)\".*", "$1");

        // 같은 차량 두 번째 발급 거부
        mvc.perform(post("/api/vouchers").contentType(MediaType.APPLICATION_JSON).content(req))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code", is("ALREADY_ISSUED")));

        // 입차 1건은 이용권 1장에만 쓰임
        mvc.perform(post("/api/vouchers").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lotCode\":\"wirari\",\"plateNumber\":\"34나5678\"}"))
                .andExpect(jsonPath("$.code", is("NO_ENTRY")));

        // 사용 처리, 두 번째는 거부
        mvc.perform(post("/api/admin/vouchers/" + code + "/redeem").header("X-Admin-Key", "test-admin"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("REDEEMED")));
        mvc.perform(post("/api/admin/vouchers/" + code + "/redeem").header("X-Admin-Key", "test-admin"))
                .andExpect(status().isConflict());

        mvc.perform(get("/api/admin/summary").header("X-Admin-Key", "test-admin"))
                .andExpect(jsonPath("$.issued", is(1)))
                .andExpect(jsonPath("$.redeemed", is(1)))
                .andExpect(jsonPath("$.entriesToday", is(1)));
    }

    @Test
    void staffCanIssueWithoutSensorAndNearLotsHaveNoVoucher() throws Exception {
        mvc.perform(post("/api/admin/vouchers").header("X-Admin-Key", "test-admin")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lotCode\":\"wirari\",\"plateNumber\":\"서울12가3456\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.channel", is("STAFF")));
        mvc.perform(post("/api/vouchers").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lotCode\":\"hwacheon-elem\",\"plateNumber\":\"12가3456\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is("NOT_INCENTIVE")));
        mvc.perform(post("/api/vouchers").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lotCode\":\"wirari\",\"plateNumber\":\"abc\"}"))
                .andExpect(jsonPath("$.code", is("PLATE")));
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
    void demoResetLetsSamePlateBeUsedAgain() throws Exception {
        sensor("{\"events\":[{\"deviceId\":\"entry-stm32\",\"seq\":1,\"direction\":\"IN\"}]}");
        String req = "{\"lotCode\":\"wirari\",\"plateNumber\":\"12가3456\"}";
        mvc.perform(post("/api/vouchers").contentType(MediaType.APPLICATION_JSON).content(req)).andExpect(status().isCreated());
        mvc.perform(post("/api/admin/demo/reset").header("X-Admin-Key", "test-admin"))
                .andExpect(jsonPath("$.deletedVouchers", is(1)));
        mvc.perform(get("/api/lots/wirari")).andExpect(jsonPath("$.currentCount", is(188)));
        sensor("{\"events\":[{\"deviceId\":\"entry-stm32\",\"seq\":2,\"direction\":\"IN\"}]}");
        mvc.perform(post("/api/vouchers").contentType(MediaType.APPLICATION_JSON).content(req)).andExpect(status().isCreated());
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
