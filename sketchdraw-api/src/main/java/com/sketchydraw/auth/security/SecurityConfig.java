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
                // Your API uses JWT and stateless sessions, so CSRF is disabled.
                .csrf(AbstractHttpConfigurer::disable)

                // Uses your existing CORS configuration bean/settings.
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

                        // Allow browser preflight requests.
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                        // Authentication APIs that require an already logged-in user.
                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/auth/me"
                        ).authenticated()

                        .requestMatchers(
                                HttpMethod.POST,
                                "/api/auth/me"
                        ).authenticated()

                        // Public authentication APIs.
                        .requestMatchers(
                                "/api/auth/register",
                                "/api/auth/verify",
                                "/api/auth/google",
                                "/api/auth/login",
                                "/api/auth/forgot-password",
                                "/api/auth/reset-password",
                                "/api/auth/resend-verification"
                        ).permitAll()

                        // Public health APIs.
                        .requestMatchers(
                                "/api/health/**",
                                "/actuator/health"
                        ).permitAll()

                        // Public announcements.
                        .requestMatchers(
                                "/api/announcement/active"
                        ).permitAll()

                        // Public subscription plans.
                        .requestMatchers(
                                "/api/plans",
                                "/api/plans/**"
                        ).permitAll()

                        // Public payment webhook.
                        .requestMatchers(
                                "/api/payment/webhook"
                        ).permitAll()

                        /*
                         * Video export APIs.
                         *
                         * These are permitted so the frontend export request is not
                         * rejected with HTTP 403 before reaching VideoExportController.
                         *
                         * Keep this path exactly the same as your controller mapping:
                         * /api/video-exports/**
                         */
                        .requestMatchers(
                                "/api/video-exports/**"
                        ).permitAll()

                        // Payment APIs require login.
                        .requestMatchers(
                                "/api/payment/**"
                        ).authenticated()

                        // Drawing APIs require login.
                        .requestMatchers(
                                "/api/drawings/**",
                                "/api/drawing-groups/**"
                        ).authenticated()

                        // Admin APIs require login.
                        .requestMatchers(
                                "/api/admin/**"
                        ).authenticated()

                        // Everything else requires authentication.
                        .anyRequest().authenticated()
                )

                /*
                 * Your JWT filter remains active for authenticated endpoints.
                 * It must not reject permitted endpoints when no Authorization
                 * header is present.
                 */
                .addFilterBefore(
                        jwtAuthenticationFilter,
                        UsernamePasswordAuthenticationFilter.class
                );

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }
}