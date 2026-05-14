package com.sketchydraw.common.util;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.MDC;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

public final class RequestContextUtil {

    private RequestContextUtil() {}

    public static String ipAddress() {
        HttpServletRequest request = currentRequest();
        if (request == null) return "UNKNOWN";

        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }

        return request.getRemoteAddr();
    }

    public static String userAgent() {
        HttpServletRequest request = currentRequest();
        if (request == null) return "UNKNOWN";

        String userAgent = request.getHeader("User-Agent");
        return userAgent == null ? "UNKNOWN" : userAgent;
    }

    public static String sessionId() {
        HttpServletRequest request = currentRequest();
        if (request == null) return "UNKNOWN";

        String sessionId = request.getHeader("X-Session-Id");
        return sessionId == null || sessionId.isBlank() ? "UNKNOWN" : sessionId;
    }

    public static String endpoint() {
        HttpServletRequest request = currentRequest();
        if (request == null) return "UNKNOWN";

        return request.getRequestURI();
    }

    public static String correlationId() {
        String correlationId = MDC.get("correlationId");
        return correlationId == null ? "UNKNOWN" : correlationId;
    }

    private static HttpServletRequest currentRequest() {
        if (!(RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs)) {
            return null;
        }
        return attrs.getRequest();
    }
}