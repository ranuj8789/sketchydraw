package com.sketchydraw.payment.repository;

import com.sketchydraw.payment.entity.UserSubscription;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.Optional;

public interface UserSubscriptionRepository extends JpaRepository<UserSubscription, Long> {

    Optional<UserSubscription> findTopByUserIdAndStatusAndEndDateAfterOrderByEndDateDesc(
            Long userId,
            String status,
            LocalDateTime now
    );
}