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
                .andExpect(jsonPath("$", hasSize(13)))
                // 발표·시연 장소(평생학습관) 50면이 맨 위, 그다음 위라리 둔치
                .andExpect(jsonPath("$[0].code", is("learning-center")))
                .andExpect(jsonPath("$[0].remaining", is(50)))
                .andExpect(jsonPath("$[1].code", is("wirari")))
                .andExpect(jsonPath("$[1].remaining", is(500)))
                .andExpect(jsonPath("$[2].capacity", nullValue()))
                .andExpect(jsonPath("$[2].level", is("UNKNOWN")));
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
        mvc.perform(get("/api/lots/learning-center"))
                .andExpect(jsonPath("$.currentCount", is(1)))
                .andExpect(jsonPath("$.remaining", is(49)))
                .andExpect(jsonPath("$.sensorOnline", is(true)));
        // 하드웨어 연결 확인이 보는 위라리 둔치는 센서 사용 표시만 유지되고 숫자는 그대로
        mvc.perform(get("/api/lots/wirari"))
                .andExpect(jsonPath("$.sensorEnabled", is(true)))
                .andExpect(jsonPath("$.currentCount", is(0)));
    }

    @Test
    void staffCanAddLotAndMoveIt() throws Exception {
        String body = "{\"name\":\"새 임시주차장\",\"category\":\"REMOTE\",\"capacity\":80,\"lat\":38.1,\"lng\":127.7,\"shuttleStop\":\"화천체육관\"}";
        mvc.perform(post("/api/admin/lots").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isUnauthorized());
        String created = mvc.perform(post("/api/admin/lots").header("X-Admin-Key", "test-admin")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.remaining", is(80)))
                .andExpect(jsonPath("$.incentive", is(true)))
                .andReturn().getResponse().getContentAsString();
        String code = created.replaceAll(".*\"code\":\"([^\"]+)\".*", "$1");
        mvc.perform(get("/api/lots")).andExpect(jsonPath("$", hasSize(14)));
        // 평생학습관 위치 옮기기 + 면수 50 그대로
        mvc.perform(patch("/api/admin/lots/learning-center").header("X-Admin-Key", "test-admin")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"lat\":38.1101,\"lng\":127.7102}"))
                .andExpect(jsonPath("$.lat", is(38.1101)))
                .andExpect(jsonPath("$.coordSource", is("현장 관리 화면에서 지정")))
                .andExpect(jsonPath("$.remaining", is(50)));
        // 화천군 밖 좌표는 거부
        mvc.perform(patch("/api/admin/lots/" + code).header("X-Admin-Key", "test-admin")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"lat\":37.5,\"lng\":127.0}"))
                .andExpect(status().isBadRequest());
        mvc.perform(patch("/api/admin/lots/" + code).header("X-Admin-Key", "test-admin")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"capacity\":60}"))
                .andExpect(jsonPath("$.remaining", is(60)));
    }

    @Test
    void demoFlowFiftyThenFortyNineThenFifty() throws Exception {
        sensor("{\"events\":[{\"deviceId\":\"entry-stm32\",\"seq\":101,\"direction\":\"IN\"}]}");
        mvc.perform(get("/api/lots/learning-center")).andExpect(jsonPath("$.remaining", is(49)));
        sensor("{\"events\":[{\"deviceId\":\"exit-pico\",\"seq\":102,\"direction\":\"OUT\"}]}");
        mvc.perform(get("/api/lots/learning-center")).andExpect(jsonPath("$.remaining", is(50)));
        // 빈 묶음(하드웨어 연결 확인)은 아무것도 바꾸지 않음
        mvc.perform(post("/api/sensor/events").header("X-Sensor-Key", "test-sensor")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"events\":[]}"))
                .andExpect(jsonPath("$.accepted", is(0)))
                .andExpect(jsonPath("$.duplicates", is(0)));
        mvc.perform(get("/api/lots/learning-center")).andExpect(jsonPath("$.remaining", is(50)));
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
        mvc.perform(get("/api/admin/lots/learning-center/sensors").header("X-Admin-Key", "test-admin"))
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
    void voucherIssuingIsGoneButBenefitNoticeRemains() throws Exception {
        mvc.perform(post("/api/vouchers").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lotCode\":\"wirari\",\"plateNumber\":\"12가3456\"}"))
                .andExpect(status().is4xxClientError());
        // 발급 기능은 없고, "이 주차장에 대면 이용권(화천군 지급)" 안내용 표시만 남음
        mvc.perform(get("/api/lots/wirari")).andExpect(jsonPath("$.incentive", is(true)));
        mvc.perform(get("/api/lots/learning-center")).andExpect(jsonPath("$.incentive", is(true)));
        mvc.perform(get("/api/lots/hwacheon-elem")).andExpect(jsonPath("$.incentive", is(false)));
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
        mvc.perform(get("/api/lots/learning-center")).andExpect(jsonPath("$.remaining", is(50)));
        // 초기화 뒤 같은 seq 를 다시 보내도 새로 센다(기록이 지워졌으므로)
        sensor("{\"events\":[{\"deviceId\":\"entry-stm32\",\"seq\":1,\"direction\":\"IN\"}]}");
        mvc.perform(get("/api/lots/learning-center")).andExpect(jsonPath("$.remaining", is(49)));
    }

    @Test
    void festivalPlacesListAndStaffCanAddEditDelete() throws Exception {
        mvc.perform(get("/api/places"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(25)))
                .andExpect(jsonPath("$[0].name", is("현장 얼음낚시터")))
                .andExpect(jsonPath("$[0].category", is("FISHING")));
        String body = "{\"name\":\"임시 화장실\",\"category\":\"ETC\",\"lat\":38.107,\"lng\":127.710}";
        mvc.perform(post("/api/admin/places").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isUnauthorized());
        String created = mvc.perform(post("/api/admin/places").header("X-Admin-Key", "test-admin")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.coordSource", is("현장 관리 화면에서 지정")))
                .andReturn().getResponse().getContentAsString();
        String id = created.replaceAll(".*\"id\":(\\d+).*", "$1");
        mvc.perform(patch("/api/admin/places/" + id).header("X-Admin-Key", "test-admin")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"fee\":\"무료\"}"))
                .andExpect(jsonPath("$.fee", is("무료")));
        // 화천 밖 좌표는 거절
        mvc.perform(patch("/api/admin/places/" + id).header("X-Admin-Key", "test-admin")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"lat\":37.5,\"lng\":127.0}"))
                .andExpect(status().isBadRequest());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .delete("/api/admin/places/" + id).header("X-Admin-Key", "test-admin"))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/places")).andExpect(jsonPath("$", hasSize(25)));
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
                .andExpect(jsonPath("$[0].stops[1].next[0]", is("10:10:00")))
                // 축제장 장소 300m 안 정류장: 청소년 수련관·구 헌병대·배수펌프장. 화천체육관에서 타면 수련관까지 10분
                .andExpect(jsonPath("$[0].festivalStops", hasSize(3)))
                .andExpect(jsonPath("$[0].stops[0].alightAt", is("청소년 수련관")))
                .andExpect(jsonPath("$[0].stops[2].rideToFestivalMinutes", is(10)))
                .andExpect(jsonPath("$[0].stops[2].alightAt", is("구 헌병대")))
                .andExpect(jsonPath("$[0].loopMinutes", is(70)))
                .andExpect(jsonPath("$[0].stops[0].rideToFestivalMinutes", is(10)))
                .andExpect(jsonPath("$[0].stops[1].rideToFestivalMinutes", is(0)))
                .andExpect(jsonPath("$[0].stops[0].minutesUntilNext", is(1)))
                // 09:59 에는 09:00·09:20·09:40 출발 버스 3대가 노선 위에 있음 (09:00 출발은 아직 한 바퀴 70분 안)
                .andExpect(jsonPath("$[0].buses", hasSize(3)));
    }
}
