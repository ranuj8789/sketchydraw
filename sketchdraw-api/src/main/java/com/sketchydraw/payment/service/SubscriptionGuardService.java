package com.sketchydraw.payment.service;

import com.sketchydraw.payment.entity.UserSubscription;
import com.sketchydraw.payment.repository.UserSubscriptionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class SubscriptionGuardService {

    private final UserSubscriptionRepository userSubscriptionRepository;

    public void requireActiveSubscription(Long userId) {
        if (!hasActiveSubscription(userId)) {
            throw new IllegalArgumentException("Active subscription required");
        }
    }

    public boolean hasActiveSubscription(Long userId) {
        return userSubscriptionRepository
                .findTopByUserIdAndStatusAndEndDateAfterOrderByEndDateDesc(
                        userId,
                        UserSubscription.STATUS_ACTIVE,
                        LocalDateTime.now()
                )
                .isPresent();
    }
}