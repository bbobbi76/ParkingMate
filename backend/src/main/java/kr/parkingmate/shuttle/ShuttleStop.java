package kr.parkingmate.shuttle;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "shuttle_stop")
public class ShuttleStop {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long routeId;
    private int seq;
    private String name;
    private double lat;
    private double lng;
    private int offsetMinutes;
    private String offsetSource;
    private String coordSource;

    protected ShuttleStop() {}

    public Long getId() { return id; }
    public Long getRouteId() { return routeId; }
    public int getSeq() { return seq; }
    public String getName() { return name; }
    public double getLat() { return lat; }
    public double getLng() { return lng; }
    public int getOffsetMinutes() { return offsetMinutes; }
    public String getOffsetSource() { return offsetSource; }
    public String getCoordSource() { return coordSource; }
}
