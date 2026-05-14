package com.sketchydraw.payment.service;

import com.sketchydraw.auth.entity.User;
import com.sketchydraw.auth.repository.UserRepository;
import com.sketchydraw.payment.dto.*;
import com.sketchydraw.payment.entity.PaymentTransaction;
import com.sketchydraw.payment.repository.PaymentTransactionRepository;
import com.sketchydraw.payment.repository.UserSubscriptionRepository;
import com.sketchydraw.plan.entity.Plan;
import com.sketchydraw.plan.entity.UserSubscription;
import com.sketchydraw.plan.repository.PlanRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static com.sketchydraw.plan.entity.UserSubscription.STATUS_ACTIVE;

@Service
@RequiredArgsConstructor
public class PaymentService {

    private final UserRepository userRepository;
    private final PlanRepository planRepository;
    private final PaymentTransactionRepository paymentTransactionRepository;
    private final UserSubscriptionRepository userSubscriptionRepository;

    public CreatePaymentResponse createPayment(String email, CreatePaymentRequest request) {
        if (request.getPlanCode() == null || request.getPlanCode().getCode().isBlank()) {
            throw new IllegalArgumentException("Plan code is required");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        Plan plan = planRepository.findByCodeAndActiveTrue(request.getPlanCode().getCode())
                .orElseThrow(() -> new IllegalArgumentException("Invalid plan"));

        PaymentTransaction tx = new PaymentTransaction();
        tx.setUserId(user.getId());
        tx.setPlanId(plan.getId());
        tx.setAmount(plan.getPrice());
        tx.setCurrency(plan.getCurrency());
        tx.setProvider("CASHFREE");
        tx.setProviderOrderId("SD_" + UUID.randomUUID().toString().replace("-", ""));
        tx.setStatus("CREATED");
        tx.setCreatedAt(LocalDateTime.now());
        tx.setUpdatedAt(LocalDateTime.now());

        paymentTransactionRepository.save(tx);

        return new CreatePaymentResponse(
                true,
                "Payment order created",
                tx.getId(),
                tx.getProviderOrderId(),
                plan.getPrice(),
                plan.getCurrency()
        );
    }

    public SubscriptionStatusResponse verifyPayment(String email, VerifyPaymentRequest request) {
        if (request.getProviderOrderId() == null || request.getProviderOrderId().isBlank()) {
            throw new IllegalArgumentException("Provider order id is required");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        PaymentTransaction tx = paymentTransactionRepository.findByProviderOrderId(request.getProviderOrderId())
                .orElseThrow(() -> new IllegalArgumentException("Payment transaction not found"));

        if (!tx.getUserId().equals(user.getId())) {
            throw new IllegalArgumentException("Payment does not belong to this user");
        }

        Plan plan = planRepository.findById(tx.getPlanId())
                .orElseThrow(() -> new IllegalArgumentException("Plan not found"));

        // TODO: Cashfree/Razorpay real signature verification yahan add hogi.
        // Abhi backend structure ready hai.

        tx.setProviderPaymentId(request.getProviderPaymentId());
        tx.setStatus("SUCCESS");
        tx.setUpdatedAt(LocalDateTime.now());
        paymentTransactionRepository.save(tx);

        LocalDateTime now = LocalDateTime.now();

        UserSubscription subscription = new UserSubscription();
        subscription.setUserId(user.getId());
        subscription.setPlanId(plan.getId());
        subscription.setCreatedAt(now);
        subscription.setEndDate(now.plusDays(plan.getValidityDays()));
        subscription.setStatus(STATUS_ACTIVE);
        subscription.setCreatedAt(now);

        userSubscriptionRepository.save(subscription);

        return new SubscriptionStatusResponse(true, subscription.getCreatedAt());
    }

    public SubscriptionStatusResponse getStatus(String email) {
//        User user = userRepository.findByEmail(email)
//                .orElseThrow(() -> new IllegalArgumentException("User not found"));
//
//        return userSubscriptionRepository
//                .findTopByUserIdAndStatusAndEndDateAfterOrderByEndDateDesc(user.getId(),  UserSubscription.STATUS_ACTIVE,LocalDateTime.now())
//                .map(sub -> new SubscriptionStatusResponse(true, sub.getCreatedAt()))
//                .orElse(new SubscriptionStatusResponse(false, null));
        return new SubscriptionStatusResponse(
                true,
                LocalDateTime.now().plusYears(1)
        );
    }
    public List<PaymentTransaction> getPaymentHistory(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        return paymentTransactionRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
    }
}