package com.sketchydraw.auth.security;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {

        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())

                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                )

                .headers(headers -> headers
                        .frameOptions(frame -> frame.deny())
                        .contentTypeOptions(Customizer.withDefaults())
                        .httpStrictTransportSecurity(hsts -> hsts
                                .includeSubDomains(true)
                                .preload(true)
                                .maxAgeInSeconds(31536000)
                        )
                )

                .authorizeHttpRequests(auth -> auth

                        // Browser preflight
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                        // Auth public APIs
                        .requestMatchers("/api/auth/**").permitAll()

                        // Public health only
                        .requestMatchers(
                                "/api/health/ping",
                                "/api/health/status",
                                "/api/health/test-mail",
                                "/api/audio/health",
                                "/api/video/health"
                        ).permitAll()

                        // Public media output download
                        .requestMatchers("/media/**").permitAll()

                        // Public analytics tracking
                        .requestMatchers("/api/analytics/track").permitAll()

                        // Public plans
                        .requestMatchers(
                                "/api/plans",
                                "/api/plans/**"
                        ).permitAll()

                        // Payment webhook must be public because Razorpay/Cashfree will call it
                        .requestMatchers("/api/payment/webhook").permitAll()

                        // Admin must always be authenticated.
                        // Real admin check will happen in AdminAccessService using admin_profile.active=true.
                        .requestMatchers("/api/admin/**").authenticated()

                        // Payment APIs
                        .requestMatchers("/api/payment/**").authenticated()

                        // Audio/video tools
                        .requestMatchers(
                                "/api/audio/**",
                                "/api/video/**"
                        ).authenticated()

                        // Analytics read APIs
                        .requestMatchers(
                                "/api/analytics/latest",
                                "/api/analytics/summary",
                                "/api/analytics/user/**",
                                "/api/analytics/session/**"
                        ).authenticated()

                        // Everything else blocked behind login
                        .anyRequest().authenticated()
                )

                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }
}