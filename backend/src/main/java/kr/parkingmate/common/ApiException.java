package kr.parkingmate.common;

import org.springframework.http.HttpStatus;

/** 화면에 그대로 보여 줄 수 있는 한국어 메시지를 담는 예외. */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    public ApiException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public HttpStatus status() {
        return status;
    }

    public String code() {
        return code;
    }

    public static ApiException notFound(String what) {
        return new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", what + "을(를) 찾을 수 없습니다.");
    }
}
