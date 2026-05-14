package com.sketchydraw.payment.service;

import com.sketchydraw.payment.repository.UserSubscriptionRepository;
import com.sketchydraw.plan.entity.UserSubscription;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class SubscriptionGuardService {

    private final UserSubscriptionRepository userSubscriptionRepository;

    public void requireActiveSubscription(Long userId) {
        Optional<UserSubscription> activeSubscription =
                userSubscriptionRepository.findTopByUserIdAndStatusAndEndDateAfterOrderByEndDateDesc(
                        userId,
                        UserSubscription.STATUS_ACTIVE,
                        LocalDateTime.now()
                );

        if (activeSubscription.isEmpty()) {
            throw new IllegalArgumentException("Active subscription required to save drawings");
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