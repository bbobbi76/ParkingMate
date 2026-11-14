package kr.parkingmate.shuttle;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ShuttleService {

    public record StopView(int seq, String name, double lat, double lng, String coordSource,
                           String timeSource, List<LocalTime> next, LocalTime first, LocalTime last) {}

    /**
     * runningNow: 지금 운행 시간 안인지.
     * serviceDate: next 시각이 해당하는 날짜(오늘 또는 다음 운행일).
     */
    public record RouteView(String name, String days, LocalTime firstDeparture, LocalTime lastDeparture,
                            int intervalMinutes, Integer busCount, String source,
                            boolean runningNow, LocalDate serviceDate, boolean serviceToday,
                            List<StopView> stops) {}

    private final ShuttleRouteRepository routes;
    private final ShuttleStopRepository stops;
    private final Clock clock;

    ShuttleService(ShuttleRouteRepository routes, ShuttleStopRepository stops, Clock clock) {
        this.routes = routes;
        this.stops = stops;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<RouteView> routes() {
        LocalDateTime now = LocalDateTime.now(clock);
        return routes.findAll().stream().map(r -> view(r, now)).toList();
    }

    RouteView view(ShuttleRoute r, LocalDateTime now) {
        Set<java.time.DayOfWeek> days = r.operatingDays();
        LocalDate date = now.toLocalDate();
        LocalTime from = now.toLocalTime();
        boolean today = days.contains(date.getDayOfWeek());
        boolean running = today && !from.isBefore(r.getFirstDeparture())
                && !from.isAfter(r.getLastDeparture().plusMinutes(60));
        // 오늘 운행이 끝났거나 운행일이 아니면 다음 운행일 첫차부터 보여 준다.
        if (!today || from.isAfter(r.getLastDeparture().plusMinutes(60))) {
            date = date.plusDays(1);
            while (!days.contains(date.getDayOfWeek())) {
                date = date.plusDays(1);
            }
            from = LocalTime.MIN;
        }
        List<StopView> out = new ArrayList<>();
        for (ShuttleStop s : stops.findByRouteIdOrderBySeqAsc(r.getId())) {
            LocalTime first = r.getFirstDeparture().plusMinutes(s.getOffsetMinutes());
            LocalTime last = r.getLastDeparture().plusMinutes(s.getOffsetMinutes());
            List<LocalTime> next = new ArrayList<>();
            for (LocalTime t = first; !t.isAfter(last) && next.size() < 3; t = t.plusMinutes(r.getIntervalMinutes())) {
                if (!t.isBefore(from)) {
                    next.add(t);
                }
                if (t.plusMinutes(r.getIntervalMinutes()).isBefore(t)) {
                    break; // 자정 넘김 방지
                }
            }
            out.add(new StopView(s.getSeq(), s.getName(), s.getLat(), s.getLng(), s.getCoordSource(),
                    s.getOffsetSource(), next, first, last));
        }
        return new RouteView(r.getName(), r.getDays(), r.getFirstDeparture(), r.getLastDeparture(),
                r.getIntervalMinutes(), r.getBusCount(), r.getSource(), running, date,
                date.equals(now.toLocalDate()), out);
    }
}
