package kr.parkingmate.shuttle;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import kr.parkingmate.place.FestivalPlace;
import kr.parkingmate.place.FestivalPlaceRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ShuttleService {

    /** 산천어축제장(화천천 얼음낚시터) 대략 위치. 프론트 lib.js 의 FESTIVAL 과 같은 점. 장소 자료가 없을 때만 쓴다. */
    static final double FESTIVAL_LAT = 38.106;
    static final double FESTIVAL_LNG = 127.7105;

    /** 축제장 장소(낚시터·체험장 등)에서 이 거리 안이면 "축제장 정류장"으로 본다. 축제장이 강을 따라 길어서 정류장이 여러 곳. */
    static final double FESTIVAL_STOP_METERS = 300;

    /**
     * festival: 축제장 바로 옆 정류장인지.
     * rideToFestivalMinutes / alightAt: 이 정류장에서 타면 다음 축제장 정류장(alightAt)까지 걸리는 시간(추정). 축제장 정류장 자신은 0.
     * minutesUntilNext: 지금부터 다음 셔틀까지 남은 분(오늘 운행일 때만, 아니면 null).
     */
    public record StopView(int seq, String name, double lat, double lng, String coordSource,
                           String timeSource, List<LocalTime> next, LocalTime first, LocalTime last,
                           boolean festival, Integer rideToFestivalMinutes, String alightAt, Integer minutesUntilNext) {}

    /**
     * 시간표로 계산한 버스 위치(실시간 GPS 아님).
     * progress: 이전 정류장→다음 정류장 사이 진행률 0~1.
     */
    public record BusView(int busNo, LocalTime departedAt, double lat, double lng,
                          String fromStop, String toStop, double progress, int minutesToNextStop) {}

    /**
     * runningNow: 지금 운행 시간 안인지.
     * serviceDate: next 시각이 해당하는 날짜(오늘 또는 다음 운행일).
     * loopMinutes: 한 바퀴 도는 시간(추정). festivalStops: 축제장 바로 옆 정류장들.
     */
    public record RouteView(String name, String days, LocalTime firstDeparture, LocalTime lastDeparture,
                            int intervalMinutes, Integer busCount, String source,
                            boolean runningNow, LocalDate serviceDate, boolean serviceToday,
                            LocalTime now, int loopMinutes, List<String> festivalStops, boolean always,
                            List<StopView> stops, List<BusView> buses) {}

    private final ShuttleRouteRepository routes;
    private final ShuttleStopRepository stops;
    private final Clock clock;
    private final FestivalPlaceRepository places;
    /** true 면 실제 운행표(토·일 09~18시)와 관계없이 매일 0시부터 같은 간격으로 계속 도는 것으로 계산(시연용). */
    private final boolean always;

    ShuttleService(ShuttleRouteRepository routes, ShuttleStopRepository stops, Clock clock, FestivalPlaceRepository places,
                   kr.parkingmate.common.AppProperties props) {
        this.routes = routes;
        this.stops = stops;
        this.clock = clock;
        this.places = places;
        this.always = props.shuttleAlways();
    }

    @Transactional(readOnly = true)
    public List<RouteView> routes() {
        LocalDateTime now = LocalDateTime.now(clock);
        return routes.findAll().stream().map(r -> view(r, now)).toList();
    }

    RouteView view(ShuttleRoute r, LocalDateTime now) {
        List<ShuttleStop> list = stops.findByRouteIdOrderBySeqAsc(r.getId());
        int loop = loopMinutes(list);
        int interval = r.getIntervalMinutes();
        Set<java.time.DayOfWeek> days = always ? java.util.EnumSet.allOf(java.time.DayOfWeek.class) : r.operatingDays();
        LocalTime firstDep = always ? LocalTime.MIDNIGHT : r.getFirstDeparture();
        // 항상 운행: 마지막 바퀴가 자정 전에 끝나도록 마지막 출발을 잡는다.
        LocalTime lastDep = always ? lastDepartureBeforeMidnight(loop, interval) : r.getLastDeparture();
        int tail = always ? loop : 60;
        LocalDate date = now.toLocalDate();
        LocalTime from = now.toLocalTime();
        boolean today = days.contains(date.getDayOfWeek());
        boolean running = today && !from.isBefore(firstDep) && !from.isAfter(lastDep.plusMinutes(tail));
        // 오늘 운행이 끝났거나 운행일이 아니면 다음 운행일 첫차부터 보여 준다.
        if (!today || from.isAfter(lastDep.plusMinutes(tail))) {
            date = date.plusDays(1);
            while (!days.contains(date.getDayOfWeek())) {
                date = date.plusDays(1);
            }
            from = LocalTime.MIN;
        }
        boolean serviceToday = date.equals(now.toLocalDate());

        boolean[] fest = festivalStops(list, places.findAll());

        List<StopView> out = new ArrayList<>();
        for (int i = 0; i < list.size(); i++) {
            ShuttleStop s = list.get(i);
            LocalTime first = firstDep.plusMinutes(s.getOffsetMinutes());
            LocalTime last = lastDep.plusMinutes(s.getOffsetMinutes());
            List<LocalTime> next = new ArrayList<>();
            for (LocalTime t = first; !t.isAfter(last) && next.size() < 3; t = t.plusMinutes(interval)) {
                if (!t.isBefore(from)) {
                    next.add(t);
                }
                if (t.plusMinutes(interval).isBefore(t)) {
                    break; // 자정 넘김 방지
                }
            }
            // 이 정류장에서 타서 처음 만나는 축제장 정류장까지(자신이 축제장 정류장이면 0)
            Integer ride = null;
            String alight = null;
            for (int step = 0; step < list.size(); step++) {
                int j = (i + step) % list.size();
                if (fest[j]) {
                    ride = Math.floorMod(list.get(j).getOffsetMinutes() - s.getOffsetMinutes(), loop);
                    alight = list.get(j).getName();
                    break;
                }
            }
            Integer until = serviceToday && !next.isEmpty()
                    ? (int) Math.max(0, Math.ceil(Duration.between(now.toLocalTime(), next.get(0)).toSeconds() / 60.0))
                    : null;
            out.add(new StopView(s.getSeq(), s.getName(), s.getLat(), s.getLng(), s.getCoordSource(),
                    s.getOffsetSource(), next, first, last, fest[i], ride, alight, until));
        }
        List<BusView> buses = serviceToday && running
                ? buses(r.getBusCount(), firstDep, lastDep, interval, list, loop, now.toLocalTime()) : List.of();
        return new RouteView(r.getName(), r.getDays(), r.getFirstDeparture(), r.getLastDeparture(),
                r.getIntervalMinutes(), r.getBusCount(), r.getSource(), running, date, serviceToday,
                now.toLocalTime().withNano(0), loop,
                out.stream().filter(StopView::festival).map(StopView::name).toList(), always, out, buses);
    }

    static LocalTime lastDepartureBeforeMidnight(int loop, int interval) {
        int latest = 24 * 60 - 1 - loop;
        int last = Math.max(0, latest - Math.floorMod(latest, interval));
        return LocalTime.of(last / 60, last % 60);
    }

    /** 마지막 정류장 → 첫 정류장 복귀 구간은 정류장 사이 평균 간격으로 추정. */
    static int loopMinutes(List<ShuttleStop> list) {
        if (list.size() < 2) {
            return 60;
        }
        int lastOffset = list.get(list.size() - 1).getOffsetMinutes();
        int gap = Math.max(1, Math.round(lastOffset / (float) (list.size() - 1)));
        return lastOffset + gap;
    }

    /** 축제장 장소에서 FESTIVAL_STOP_METERS 안의 정류장. 장소 자료가 없으면 축제장 기준점에서 가장 가까운 1곳. */
    static boolean[] festivalStops(List<ShuttleStop> list, List<FestivalPlace> placeList) {
        boolean[] out = new boolean[list.size()];
        boolean any = false;
        for (int i = 0; i < list.size(); i++) {
            ShuttleStop s = list.get(i);
            for (FestivalPlace p : placeList) {
                if (meters(s.getLat(), s.getLng(), p.getLat(), p.getLng()) <= FESTIVAL_STOP_METERS) {
                    out[i] = true;
                    any = true;
                    break;
                }
            }
        }
        if (!any && !list.isEmpty()) {
            int best = 0;
            for (int i = 1; i < list.size(); i++) {
                if (meters(list.get(i).getLat(), list.get(i).getLng(), FESTIVAL_LAT, FESTIVAL_LNG)
                        < meters(list.get(best).getLat(), list.get(best).getLng(), FESTIVAL_LAT, FESTIVAL_LNG)) {
                    best = i;
                }
            }
            out[best] = true;
        }
        return out;
    }

    static double meters(double lat1, double lng1, double lat2, double lng2) {
        double dLat = (lat2 - lat1) * 111_000;
        double dLng = (lng2 - lng1) * 111_000 * Math.cos(Math.toRadians((lat1 + lat2) / 2));
        return Math.hypot(dLat, dLng);
    }

    /** 지금 노선 위에 있어야 할 버스들. 첫 정류장 출발 시각부터 흐른 시간으로 위치를 계산한다. */
    static List<BusView> buses(Integer buses, LocalTime firstDep, LocalTime lastDep, int interval,
                               List<ShuttleStop> list, int loop, LocalTime now) {
        List<BusView> out = new ArrayList<>();
        if (list.isEmpty()) {
            return out;
        }
        int busCount = buses == null || buses < 1 ? 1 : buses;
        double nowMin = now.toSecondOfDay() / 60.0;
        int k = 0;
        for (LocalTime d = firstDep; !d.isAfter(lastDep); d = d.plusMinutes(interval), k++) {
            double elapsed = nowMin - d.toSecondOfDay() / 60.0;
            if (elapsed >= 0 && elapsed < loop) {
                out.add(position(k % busCount + 1, d, list, loop, elapsed));
            }
            if (d.plusMinutes(interval).isBefore(d)) {
                break;
            }
        }
        return out;
    }

    static BusView position(int busNo, LocalTime departedAt, List<ShuttleStop> list, int loop, double elapsed) {
        for (int i = 0; i < list.size(); i++) {
            ShuttleStop a = list.get(i);
            ShuttleStop b = list.get((i + 1) % list.size());
            int start = a.getOffsetMinutes();
            int end = i + 1 < list.size() ? b.getOffsetMinutes() : loop;
            if (elapsed >= start && elapsed < end) {
                double p = (elapsed - start) / Math.max(1, end - start);
                double lat = a.getLat() + (b.getLat() - a.getLat()) * p;
                double lng = a.getLng() + (b.getLng() - a.getLng()) * p;
                int toNext = (int) Math.ceil(end - elapsed);
                return new BusView(busNo, departedAt, lat, lng, a.getName(), b.getName(),
                        Math.round(p * 100) / 100.0, toNext);
            }
        }
        ShuttleStop a = list.get(0);
        return new BusView(busNo, departedAt, a.getLat(), a.getLng(), a.getName(), a.getName(), 0, 0);
    }
}
