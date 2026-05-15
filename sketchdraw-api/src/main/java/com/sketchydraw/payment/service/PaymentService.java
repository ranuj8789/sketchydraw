package com.sketchydraw.payment.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sketchydraw.auth.entity.User;
import com.sketchydraw.auth.repository.UserRepository;
import com.sketchydraw.payment.dto.CreatePaymentRequest;
import com.sketchydraw.payment.dto.CreatePaymentResponse;
import com.sketchydraw.payment.dto.SubscriptionStatusResponse;
import com.sketchydraw.payment.dto.VerifyPaymentRequest;
import com.sketchydraw.payment.entity.PaymentTransaction;
import com.sketchydraw.payment.entity.UserSubscription;
import com.sketchydraw.payment.repository.PaymentTransactionRepository;
import com.sketchydraw.payment.repository.UserSubscriptionRepository;
import com.sketchydraw.plan.entity.Plan;
import com.sketchydraw.plan.repository.PlanRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PaymentService {

    private final UserRepository userRepository;
    private final PlanRepository planRepository;
    private final PaymentTransactionRepository paymentTransactionRepository;
    private final UserSubscriptionRepository userSubscriptionRepository;
    private final ObjectMapper objectMapper;

    @Value("${cashfree.mode:sandbox}")
    private String cashfreeMode;

    @Value("${cashfree.client-id:}")
    private String cashfreeClientId;

    @Value("${cashfree.client-secret:}")
    private String cashfreeClientSecret;

    @Value("${cashfree.api-version:2025-01-01}")
    private String cashfreeApiVersion;

    @Value("${cashfree.return-url:http://localhost:3000/payment/success?order_id={order_id}}")
    private String cashfreeReturnUrl;

    @Value("${cashfree.notify-url:}")
    private String cashfreeNotifyUrl;

    public CreatePaymentResponse createPayment(String email, CreatePaymentRequest request) {
        if (request.getPlanCode() == null || request.getPlanCode().isBlank()) {
            throw new IllegalArgumentException("Plan code is required");
        }

        validateCashfreeConfig();

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        Plan plan = planRepository.findByCodeAndActiveTrue(request.getPlanCode().trim())
                .orElseThrow(() -> new IllegalArgumentException("Invalid or inactive plan"));

        String providerOrderId = "SD_" + UUID.randomUUID().toString().replace("-", "");

        PaymentTransaction tx = new PaymentTransaction();
        tx.setUserId(user.getId());
        tx.setPlanId(plan.getId());
        tx.setAmount(plan.getPrice());
        tx.setCurrency(plan.getCurrency() == null ? "INR" : plan.getCurrency());
        tx.setProvider("CASHFREE");
        tx.setProviderOrderId(providerOrderId);
        tx.setStatus("CREATED");
        tx.setCreatedAt(LocalDateTime.now());
        tx.setUpdatedAt(LocalDateTime.now());

        paymentTransactionRepository.save(tx);

        try {
            JsonNode cashfreeOrder = createCashfreeOrder(user, plan, providerOrderId);

            String paymentSessionId = cashfreeOrder.path("payment_session_id").asText(null);
            String cfOrderId = cashfreeOrder.path("cf_order_id").asText(null);

            if (paymentSessionId == null || paymentSessionId.isBlank()) {
                markFailed(tx);
                throw new IllegalStateException("Cashfree payment_session_id missing");
            }

            tx.setProviderPaymentId(cfOrderId);
            tx.setStatus("ORDER_CREATED");
            tx.setUpdatedAt(LocalDateTime.now());
            paymentTransactionRepository.save(tx);

            return new CreatePaymentResponse(
                    true,
                    "Cashfree order created",
                    tx.getId(),
                    providerOrderId,
                    cfOrderId,
                    plan.getPrice(),
                    tx.getCurrency(),
                    paymentSessionId
            );
        } catch (Exception e) {
            markFailed(tx);
            throw new RuntimeException("Unable to create Cashfree order: " + e.getMessage(), e);
        }
    }

    private void validateCashfreeConfig() {
        if (cashfreeClientId == null || cashfreeClientId.isBlank()) {
            throw new IllegalStateException("Cashfree client-id missing");
        }

        if (cashfreeClientSecret == null || cashfreeClientSecret.isBlank()) {
            throw new IllegalStateException("Cashfree client-secret missing");
        }
    }

    private JsonNode createCashfreeOrder(User user, Plan plan, String providerOrderId) throws Exception {
        String endpoint = "production".equalsIgnoreCase(cashfreeMode)
                ? "https://api.cashfree.com/pg/orders"
                : "https://sandbox.cashfree.com/pg/orders";

        BigDecimal amount = plan.getPrice();
        String currency = plan.getCurrency() == null ? "INR" : plan.getCurrency();

        Map<String, Object> orderMeta =
                cashfreeNotifyUrl == null || cashfreeNotifyUrl.isBlank()
                        ? Map.of("return_url", cashfreeReturnUrl)
                        : Map.of(
                        "return_url", cashfreeReturnUrl,
                        "notify_url", cashfreeNotifyUrl
                );

        Map<String, Object> body = Map.of(
                "order_id", providerOrderId,
                "order_amount", amount,
                "order_currency", currency,
                "order_note", "SketchyDraw subscription - " + plan.getCode(),
                "customer_details", Map.of(
                        "customer_id", "USER_" + user.getId(),
                        "customer_email", user.getEmail(),
                        "customer_phone", "9999999999"
                ),
                "order_meta", orderMeta
        );

        String requestJson = objectMapper.writeValueAsString(body);

        HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .header("Content-Type", "application/json")
                .header("x-api-version", cashfreeApiVersion)
                .header("x-client-id", cashfreeClientId)
                .header("x-client-secret", cashfreeClientSecret)
                .header("x-request-id", providerOrderId)
                .header("x-idempotency-key", providerOrderId)
                .POST(HttpRequest.BodyPublishers.ofString(requestJson))
                .build();

        HttpResponse<String> httpResponse = HttpClient
                .newHttpClient()
                .send(httpRequest, HttpResponse.BodyHandlers.ofString());

        if (httpResponse.statusCode() < 200 || httpResponse.statusCode() >= 300) {
            throw new RuntimeException("Cashfree error " + httpResponse.statusCode() + ": " + httpResponse.body());
        }

        return objectMapper.readTree(httpResponse.body());
    }

    private void markFailed(PaymentTransaction tx) {
        tx.setStatus("FAILED");
        tx.setUpdatedAt(LocalDateTime.now());
        paymentTransactionRepository.save(tx);
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

        tx.setProviderPaymentId(request.getProviderPaymentId());
        tx.setStatus("SUCCESS");
        tx.setUpdatedAt(LocalDateTime.now());
        paymentTransactionRepository.save(tx);

        LocalDateTime now = LocalDateTime.now();

        UserSubscription subscription = new UserSubscription();
        subscription.setUserId(user.getId());
        subscription.setPlanId(plan.getId());
        subscription.setStatus(UserSubscription.STATUS_ACTIVE);
        subscription.setStartDate(now);
        subscription.setEndDate(now.plusDays(plan.getValidityDays()));
        subscription.setCreatedAt(now);
        subscription.setUpdatedAt(now);

        userSubscriptionRepository.save(subscription);

        return new SubscriptionStatusResponse(true, subscription.getEndDate());
    }

    public SubscriptionStatusResponse getStatus(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        return userSubscriptionRepository
                .findTopByUserIdAndStatusAndEndDateAfterOrderByEndDateDesc(
                        user.getId(),
                        UserSubscription.STATUS_ACTIVE,
                        LocalDateTime.now()
                )
                .map(sub -> new SubscriptionStatusResponse(true, sub.getEndDate()))
                .orElse(new SubscriptionStatusResponse(false, null));
    }

    public List<PaymentTransaction> getPaymentHistory(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        return paymentTransactionRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
    }
}