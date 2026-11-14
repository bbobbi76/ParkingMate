package kr.parkingmate.shuttle;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

@Entity
@Table(name = "shuttle_route")
public class ShuttleRoute {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String days;
    private LocalTime firstDeparture;
    private LocalTime lastDeparture;
    private int intervalMinutes;
    private Integer busCount;
    private String source;

    protected ShuttleRoute() {}

    public Set<DayOfWeek> operatingDays() {
        return Arrays.stream(days.split(","))
                .map(String::trim)
                .map(d -> switch (d) {
                    case "MON" -> DayOfWeek.MONDAY;
                    case "TUE" -> DayOfWeek.TUESDAY;
                    case "WED" -> DayOfWeek.WEDNESDAY;
                    case "THU" -> DayOfWeek.THURSDAY;
                    case "FRI" -> DayOfWeek.FRIDAY;
                    case "SAT" -> DayOfWeek.SATURDAY;
                    default -> DayOfWeek.SUNDAY;
                })
                .collect(Collectors.toSet());
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getDays() { return days; }
    public LocalTime getFirstDeparture() { return firstDeparture; }
    public LocalTime getLastDeparture() { return lastDeparture; }
    public int getIntervalMinutes() { return intervalMinutes; }
    public Integer getBusCount() { return busCount; }
    public String getSource() { return source; }
}
