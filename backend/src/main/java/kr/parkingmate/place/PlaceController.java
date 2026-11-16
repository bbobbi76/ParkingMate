package kr.parkingmate.place;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import kr.parkingmate.common.ApiException;
import kr.parkingmate.common.KeyGuard;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 축제장 장소: 누구나 조회, 현장 관리(관리자 키)만 추가·수정·삭제. */
@RestController
@RequestMapping("/api")
public class PlaceController {

    public record PlaceView(Long id, String name, String category, String description, String fee,
                            double lat, double lng, String coordSource, String infoSource, Instant updatedAt) {
        static PlaceView of(FestivalPlace p) {
            return new PlaceView(p.getId(), p.getName(), p.getCategory().name(), p.getDescription(), p.getFee(),
                    p.getLat(), p.getLng(), p.getCoordSource(), p.getInfoSource(), p.getUpdatedAt());
        }
    }

    public record CreateRequest(@NotBlank @Size(max = 60) String name, @NotNull FestivalPlace.Category category,
                                @Size(max = 300) String description, @Size(max = 200) String fee,
                                @NotNull Double lat, @NotNull Double lng) {}

    public record UpdateRequest(@Size(max = 60) String name, FestivalPlace.Category category,
                                @Size(max = 300) String description, @Size(max = 200) String fee,
                                Double lat, Double lng) {}

    private final FestivalPlaceRepository repo;
    private final KeyGuard guard;
    private final Clock clock;

    public PlaceController(FestivalPlaceRepository repo, KeyGuard guard, Clock clock) {
        this.repo = repo;
        this.guard = guard;
        this.clock = clock;
    }

    @GetMapping("/places")
    @Transactional(readOnly = true)
    public List<PlaceView> list() {
        return repo.findAll(Sort.by("sortOrder", "id")).stream().map(PlaceView::of).toList();
    }

    @PostMapping("/admin/places")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public PlaceView create(@RequestHeader(value = "X-Admin-Key", required = false) String key,
                            @Valid @RequestBody CreateRequest req) {
        guard.requireAdmin(key);
        checkCoords(req.lat(), req.lng());
        Instant now = clock.instant();
        FestivalPlace p = new FestivalPlace(req.name().trim(), req.category(), req.lat(), req.lng(),
                "현장 관리 화면에서 지정", "현장 관리 화면에서 추가", now);
        p.update(null, null, req.description(), req.fee(), null, null, null, now);
        return PlaceView.of(repo.save(p));
    }

    @PatchMapping("/admin/places/{id}")
    @Transactional
    public PlaceView update(@RequestHeader(value = "X-Admin-Key", required = false) String key,
                            @PathVariable Long id, @Valid @RequestBody UpdateRequest req) {
        guard.requireAdmin(key);
        FestivalPlace p = repo.findById(id).orElseThrow(() -> ApiException.notFound("장소"));
        boolean moved = req.lat() != null || req.lng() != null;
        if (moved) {
            checkCoords(req.lat() != null ? req.lat() : p.getLat(), req.lng() != null ? req.lng() : p.getLng());
        }
        p.update(req.name() == null ? null : req.name().trim(), req.category(), req.description(), req.fee(),
                req.lat(), req.lng(), moved ? "현장 관리 화면에서 지정" : null, clock.instant());
        return PlaceView.of(p);
    }

    @DeleteMapping("/admin/places/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void delete(@RequestHeader(value = "X-Admin-Key", required = false) String key, @PathVariable Long id) {
        guard.requireAdmin(key);
        if (!repo.existsById(id)) {
            throw ApiException.notFound("장소");
        }
        repo.deleteById(id);
    }

    /** 화천군 안쪽 대략 범위만 허용(잘못 찍은 좌표 방지). */
    private static void checkCoords(double lat, double lng) {
        if (lat < 37.9 || lat > 38.35 || lng < 127.4 || lng > 128.0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_COORD", "화천군 안의 위치를 지도에서 골라 주세요.");
        }
    }
}
