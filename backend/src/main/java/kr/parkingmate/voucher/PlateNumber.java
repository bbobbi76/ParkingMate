package kr.parkingmate.voucher;

import java.util.regex.Pattern;
import kr.parkingmate.common.ApiException;
import org.springframework.http.HttpStatus;

/** 차량번호 정리: 공백 제거 후 "12가3456", "123가4567", "서울12가3456" 형식만 허용. */
final class PlateNumber {

    private static final Pattern VALID = Pattern.compile("^([가-힣]{2})?\\d{2,3}[가-힣]\\d{4}$");

    private PlateNumber() {}

    static String normalize(String raw) {
        String s = raw == null ? "" : raw.replaceAll("[\\s-]", "");
        if (!VALID.matcher(s).matches()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PLATE",
                    "차량번호를 다시 확인해 주세요. 예) 12가 3456");
        }
        return s;
    }
}
