package com.sketchydraw.auth.repository;


import com.sketchydraw.auth.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    Optional<User> findByVerificationToken(String token);

    Optional<User> findByResetToken(String token);

    Optional<User> findByProviderAndProviderUserId(String provider, String providerUserId);

    List<User> findTop50ByOrderByCreatedAtDesc();
}