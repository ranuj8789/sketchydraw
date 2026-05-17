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

                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                        // Auth public APIs
                        .requestMatchers("/api/auth/**").permitAll()

                        // Public health
                        .requestMatchers(
                                "/api/health/**",
                                "/actuator/health"
                        ).permitAll()

                        // Public announcements
                        .requestMatchers(
                                "/api/announcement/active"
                        ).permitAll()

                        // Public plans for Subscribe popup
                        .requestMatchers(
                                "/api/plans",
                                "/api/plans/**"
                        ).permitAll()

                        // Payment webhook public
                        .requestMatchers(
                                "/api/payment/webhook"
                        ).permitAll()

                        // Payment APIs need login
                        .requestMatchers(
                                "/api/payment/**"
                        ).authenticated()

                        // Drawing APIs need login
                        .requestMatchers(
                                "/api/drawings/**",
                                "/api/drawing-groups/**"
                        ).authenticated()

                        // Admin APIs need login
                        .requestMatchers(
                                "/api/admin/**"
                        ).authenticated()

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