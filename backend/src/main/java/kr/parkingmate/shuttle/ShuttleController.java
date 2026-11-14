package kr.parkingmate.shuttle;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class ShuttleController {

    private final ShuttleService service;

    public ShuttleController(ShuttleService service) {
        this.service = service;
    }

    @GetMapping("/shuttle")
    public List<ShuttleService.RouteView> routes() {
        return service.routes();
    }
}
