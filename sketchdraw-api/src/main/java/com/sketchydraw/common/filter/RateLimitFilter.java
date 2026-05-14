package com.sketchydraw.common.filter;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;

@Component
@RequiredArgsConstructor
public class RateLimitFilter implements Filter {

    private final StringRedisTemplate redisTemplate;

    @Value("${rate.limit.ip.requests:60}")
    private int ipMaxRequests;

    @Value("${rate.limit.user.requests:120}")
    private int userMaxRequests;

    @Value("${rate.limit.window-seconds:60}")
    private int windowSeconds;

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    @Value("${rate.limit.enabled:true}")
    private boolean rateLimitEnabled;

    @Value("${rate.limit.redis-prefix:sketchydraw}")
    private String redisPrefix;

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest req = (HttpServletRequest) request;
        HttpServletResponse res = (HttpServletResponse) response;

        if (!rateLimitEnabled) {
            chain.doFilter(request, response);
            return;
        }

        String path = req.getRequestURI();

        if (shouldSkip(path)) {
            chain.doFilter(request, response);
            return;
        }

        String ip = getClientIp(req);
        String normalizedPath = normalizePath(path);

        String ipKey = redisPrefix + ":rate_limit:ip:" + ip + ":" + normalizedPath;

        RateLimitResult ipResult = incrementAndCheck(ipKey, ipMaxRequests);

        if (ipResult.blocked()) {
            writeBlockedResponse(
                    res,
                    "IP_RATE_LIMIT_EXCEEDED",
                    "Too many requests from this IP. Please try again later.",
                    ipResult.retryAfterSeconds()
            );
            return;
        }

        String email = extractEmailFromJwt(req);

        if (email != null && !email.isBlank()) {
            String userKey = redisPrefix + ":rate_limit:user:" + email.toLowerCase(Locale.ROOT) + ":" + normalizedPath;
            RateLimitResult userResult = incrementAndCheck(userKey, userMaxRequests);

            if (userResult.blocked()) {
                writeBlockedResponse(
                        res,
                        "USER_RATE_LIMIT_EXCEEDED",
                        "Too many requests from this account. Please try again later.",
                        userResult.retryAfterSeconds()
                );
                return;
            }
        }

        chain.doFilter(request, response);
    }

    private RateLimitResult incrementAndCheck(String key, int maxRequests) {
        Long count = redisTemplate.opsForValue().increment(key);

        if (count != null && count == 1) {
            redisTemplate.expire(key, Duration.ofSeconds(windowSeconds));
        }

        Long ttl = redisTemplate.getExpire(key);
        long retryAfterSeconds = ttl == null || ttl < 0 ? windowSeconds : ttl;

        boolean blocked = count != null && count > maxRequests;

        return new RateLimitResult(blocked, count == null ? 0 : count, retryAfterSeconds);
    }

    private boolean shouldSkip(String path) {
        return path.startsWith("/media/")
                || path.startsWith("/api/health")
                || path.startsWith("/api/auth/verify")
                || path.startsWith("/api/payment/webhook");
    }

    private String normalizePath(String path) {
        if (path == null || path.isBlank()) {
            return "unknown";
        }

        return path
                .replaceAll("/\\d+", "/{id}")
                .replaceAll("[^a-zA-Z0-9/_{}.-]", "_");
    }

    private String getClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");

        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }

        String realIp = request.getHeader("X-Real-IP");

        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }

        return request.getRemoteAddr();
    }

    private String extractEmailFromJwt(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return null;
        }

        String token = authHeader.substring(7);

        try {
            SecretKey secretKey = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));

            Claims claims = Jwts.parser()
                    .verifyWith(secretKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            return claims.getSubject();

        } catch (Exception e) {
            return null;
        }
    }

    private void writeBlockedResponse(
            HttpServletResponse response,
            String code,
            String message,
            long retryAfterSeconds
    ) throws IOException {

        response.setStatus(429);
        response.setContentType("application/json");
        response.setHeader("Retry-After", String.valueOf(retryAfterSeconds));

        response.getWriter().write("""
                {
                  "success": false,
                  "message": "%s",
                  "code": "%s",
                  "retryAfterSeconds": %d
                }
                """.formatted(message, code, retryAfterSeconds));
    }

    private record RateLimitResult(
            boolean blocked,
            long count,
            long retryAfterSeconds
    ) {
    }
}