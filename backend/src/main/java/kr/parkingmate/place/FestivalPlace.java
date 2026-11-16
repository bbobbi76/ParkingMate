package kr.parkingmate.place;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** 축제장 안 장소(낚시터·체험장·먹거리·안내). */
@Entity
@Table(name = "festival_place")
public class FestivalPlace {

    public enum Category { FISHING, SNOW, CULTURE, FOOD, INFO, ETC }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    @Enumerated(EnumType.STRING)
    private Category category;

    private String description;
    private String fee;
    private double lat;
    private double lng;
    private String coordSource;
    private String infoSource;
    private int sortOrder;
    private Instant updatedAt;

    protected FestivalPlace() {}

    public FestivalPlace(String name, Category category, double lat, double lng, String coordSource,
                         String infoSource, Instant now) {
        this.name = name;
        this.category = category;
        this.lat = lat;
        this.lng = lng;
        this.coordSource = coordSource;
        this.infoSource = infoSource;
        this.sortOrder = 100;
        this.updatedAt = now;
    }

    public void update(String name, Category category, String description, String fee,
                       Double lat, Double lng, String coordSource, Instant now) {
        if (name != null) this.name = name;
        if (category != null) this.category = category;
        if (description != null) this.description = description.isBlank() ? null : description;
        if (fee != null) this.fee = fee.isBlank() ? null : fee;
        if (lat != null) this.lat = lat;
        if (lng != null) this.lng = lng;
        if (coordSource != null) this.coordSource = coordSource;
        this.updatedAt = now;
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public Category getCategory() { return category; }
    public String getDescription() { return description; }
    public String getFee() { return fee; }
    public double getLat() { return lat; }
    public double getLng() { return lng; }
    public String getCoordSource() { return coordSource; }
    public String getInfoSource() { return infoSource; }
    public int getSortOrder() { return sortOrder; }
    public Instant getUpdatedAt() { return updatedAt; }
}
