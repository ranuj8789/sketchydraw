package com.sketchydraw.auth.util;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Component
public class JwtUtil {

    private final SecretKey secretKey;
    private final long expiryMs;

    public JwtUtil(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.expiry-ms:86400000}") long expiryMs
    ) {
        this.secretKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expiryMs = expiryMs;
    }

    public String generateToken(Long userId, String email) {
        long now = System.currentTimeMillis();

        return Jwts.builder()
                .subject(email)
                .claim("userId", userId)
                .claim("email", email)
                .issuedAt(new Date(now))
                .expiration(new Date(now + expiryMs))
                .signWith(secretKey)
                .compact();
    }
}