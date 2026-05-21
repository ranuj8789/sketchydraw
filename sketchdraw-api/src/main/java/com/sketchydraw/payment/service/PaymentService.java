package com.sketchydraw.payment.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.razorpay.Order;
import com.razorpay.RazorpayClient;
import com.razorpay.Utils;
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
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
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

    private static final String PROVIDER_CASHFREE = "CASHFREE";
    private static final String PROVIDER_RAZORPAY = "RAZORPAY";

    private static final String PAYMENT_STATUS_CREATED = "CREATED";
    private static final String PAYMENT_STATUS_ORDER_CREATED = "ORDER_CREATED";
    private static final String PAYMENT_STATUS_SUCCESS = "SUCCESS";
    private static final String PAYMENT_STATUS_FAILED = "FAILED";

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

    @Value("${razorpay.key-id:}")
    private String razorpayKeyId;

    @Value("${razorpay.key-secret:}")
    private String razorpayKeySecret;

    public CreatePaymentResponse createPayment(String email, CreatePaymentRequest request) {
        if (request.getPlanCode() == null || request.getPlanCode().isBlank()) {
            throw new IllegalArgumentException("Plan code is required");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        Plan plan = planRepository.findByCodeAndActiveTrue(request.getPlanCode().trim())
                .orElseThrow(() -> new IllegalArgumentException("Invalid or inactive plan"));

        validateSubscriptionPlan(plan);

        String provider = normalizeProvider(request.getProvider());

        if (PROVIDER_RAZORPAY.equals(provider)) {
            return createRazorpayPayment(user, plan);
        }

        return createCashfreePayment(user, plan);
    }

    private CreatePaymentResponse createCashfreePayment(User user, Plan plan) {
        validateCashfreeConfig();

        String providerOrderId = "SD_CF_" + UUID.randomUUID().toString().replace("-", "");

        PaymentTransaction tx = createBaseTransaction(
                user,
                plan,
                providerOrderId,
                PROVIDER_CASHFREE
        );

        try {
            JsonNode cashfreeOrder = createCashfreeOrder(user, plan, providerOrderId);

            String paymentSessionId = cashfreeOrder.path("payment_session_id").asText(null);
            String cfOrderId = cashfreeOrder.path("cf_order_id").asText(null);

            if (paymentSessionId == null || paymentSessionId.isBlank()) {
                markFailed(tx);
                throw new IllegalStateException("Cashfree payment_session_id missing");
            }

            tx.setProviderPaymentId(cfOrderId);
            tx.setStatus(PAYMENT_STATUS_ORDER_CREATED);
            tx.setUpdatedAt(LocalDateTime.now());
            paymentTransactionRepository.save(tx);

            return new CreatePaymentResponse(
                    true,
                    "Cashfree order created",
                    tx.getId(),
                    PROVIDER_CASHFREE,
                    providerOrderId,
                    tx.getProviderPaymentId(),
                    cfOrderId,
                    plan.getPrice(),
                    tx.getCurrency(),
                    paymentSessionId,
                    null
            );
        } catch (Exception e) {
            markFailed(tx);
            throw new RuntimeException("Unable to create Cashfree order: " + e.getMessage(), e);
        }
    }

    private CreatePaymentResponse createRazorpayPayment(User user, Plan plan) {
        validateRazorpayConfig();

        String receipt = "SD_RZP_" + UUID.randomUUID().toString().replace("-", "");

        PaymentTransaction tx = createBaseTransaction(
                user,
                plan,
                receipt,
                PROVIDER_RAZORPAY
        );

        try {
            Order razorpayOrder = createRazorpayOrder(plan, receipt);

            String razorpayOrderId = razorpayOrder.get("id");

            if (razorpayOrderId == null || razorpayOrderId.isBlank()) {
                markFailed(tx);
                throw new IllegalStateException("Razorpay order id missing");
            }

            /*
             * Important:
             * For Razorpay verification, providerOrderId must be Razorpay's real order id:
             * order_xxxxx
             */
            tx.setProviderOrderId(razorpayOrderId);
            tx.setStatus(PAYMENT_STATUS_ORDER_CREATED);
            tx.setUpdatedAt(LocalDateTime.now());
            paymentTransactionRepository.save(tx);

            return new CreatePaymentResponse(
                    true,
                    "Razorpay order created",
                    tx.getId(),
                    PROVIDER_RAZORPAY,
                    razorpayOrderId,
                    null,
                    null,
                    plan.getPrice(),
                    tx.getCurrency(),
                    null,
                    razorpayKeyId
            );
        } catch (Exception e) {
            markFailed(tx);
            throw new RuntimeException("Unable to create Razorpay order: " + e.getMessage(), e);
        }
    }

    private PaymentTransaction createBaseTransaction(
            User user,
            Plan plan,
            String providerOrderId,
            String provider
    ) {
        PaymentTransaction tx = new PaymentTransaction();
        tx.setUserId(user.getId());
        tx.setPlanId(plan.getId());
        tx.setAmount(plan.getPrice());
        tx.setCurrency(plan.getCurrency() == null ? "INR" : plan.getCurrency());
        tx.setProvider(provider);
        tx.setProviderOrderId(providerOrderId);
        tx.setStatus(PAYMENT_STATUS_CREATED);
        tx.setCreatedAt(LocalDateTime.now());
        tx.setUpdatedAt(LocalDateTime.now());

        return paymentTransactionRepository.save(tx);
    }

    private void validateSubscriptionPlan(Plan plan) {
        if (plan.getPrice() == null || plan.getPrice().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Invalid plan price");
        }

        if (plan.getValidityDays() == null || plan.getValidityDays() <= 0) {
            throw new IllegalArgumentException("Invalid plan validity");
        }

        if (plan.getCurrency() == null || plan.getCurrency().isBlank()) {
            throw new IllegalArgumentException("Invalid plan currency");
        }
    }

    private String normalizeProvider(String provider) {
        if (provider == null || provider.isBlank()) {
            return PROVIDER_RAZORPAY;
        }

        String value = provider.trim().toUpperCase();

        if (PROVIDER_RAZORPAY.equals(value)) {
            return PROVIDER_RAZORPAY;
        }

        if (PROVIDER_CASHFREE.equals(value)) {
            return PROVIDER_CASHFREE;
        }

        throw new IllegalArgumentException("Unsupported payment provider: " + provider);
    }

    private void validateCashfreeConfig() {
        if (cashfreeClientId == null || cashfreeClientId.isBlank()) {
            throw new IllegalStateException("Cashfree client-id missing");
        }

        if (cashfreeClientSecret == null || cashfreeClientSecret.isBlank()) {
            throw new IllegalStateException("Cashfree client-secret missing");
        }
    }

    private void validateRazorpayConfig() {
        if (razorpayKeyId == null || razorpayKeyId.isBlank()) {
            throw new IllegalStateException("Razorpay key-id missing");
        }

        if (razorpayKeySecret == null || razorpayKeySecret.isBlank()) {
            throw new IllegalStateException("Razorpay key-secret missing");
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

    private Order createRazorpayOrder(Plan plan, String receipt) throws Exception {
        RazorpayClient razorpayClient = new RazorpayClient(razorpayKeyId, razorpayKeySecret);

        String currency = plan.getCurrency() == null ? "INR" : plan.getCurrency();

        int amountInSmallestUnit = plan.getPrice()
                .multiply(BigDecimal.valueOf(100))
                .setScale(0, RoundingMode.HALF_UP)
                .intValueExact();

        JSONObject orderRequest = new JSONObject();
        orderRequest.put("amount", amountInSmallestUnit);
        orderRequest.put("currency", currency);
        orderRequest.put("receipt", receipt);
        orderRequest.put("payment_capture", 1);

        JSONObject notes = new JSONObject();
        notes.put("planCode", plan.getCode());
        notes.put("app", "SketchyDraw");
        notes.put("productType", plan.getProductType());
        orderRequest.put("notes", notes);

        return razorpayClient.orders.create(orderRequest);
    }

    private void markFailed(PaymentTransaction tx) {
        tx.setStatus(PAYMENT_STATUS_FAILED);
        tx.setUpdatedAt(LocalDateTime.now());
        paymentTransactionRepository.save(tx);
    }

    public SubscriptionStatusResponse verifyPayment(String email, VerifyPaymentRequest request) {
        if (request.getProviderOrderId() == null || request.getProviderOrderId().isBlank()) {
            throw new IllegalArgumentException("Provider order id is required");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        PaymentTransaction tx = paymentTransactionRepository.findByProviderOrderId(
                request.getProviderOrderId()
        ).orElseThrow(() -> new IllegalArgumentException("Payment transaction not found"));

        if (!tx.getUserId().equals(user.getId())) {
            throw new IllegalArgumentException("Payment does not belong to this user");
        }

        if (PAYMENT_STATUS_SUCCESS.equalsIgnoreCase(tx.getStatus())) {
            return getStatus(email);
        }

        if (PROVIDER_RAZORPAY.equalsIgnoreCase(tx.getProvider())) {
            verifyRazorpaySignature(request);
        } else if (PROVIDER_CASHFREE.equalsIgnoreCase(tx.getProvider())) {
            /*
             * Cashfree is kept as your existing flow.
             * Before production, improve this by verifying Cashfree order/payment status
             * or webhook signature before marking SUCCESS.
             */
        } else {
            throw new IllegalArgumentException("Unsupported provider for verification");
        }

        Plan plan = planRepository.findById(tx.getPlanId())
                .orElseThrow(() -> new IllegalArgumentException("Plan not found"));

        tx.setProviderPaymentId(request.getProviderPaymentId());
        tx.setStatus(PAYMENT_STATUS_SUCCESS);
        tx.setUpdatedAt(LocalDateTime.now());
        paymentTransactionRepository.save(tx);

        UserSubscription subscription = createOrExtendSubscription(user, plan);

        return new SubscriptionStatusResponse(true, subscription.getEndDate());
    }

    private void verifyRazorpaySignature(VerifyPaymentRequest request) {
        if (request.getProviderPaymentId() == null || request.getProviderPaymentId().isBlank()) {
            throw new IllegalArgumentException("Razorpay payment id is required");
        }

        if (request.getSignature() == null || request.getSignature().isBlank()) {
            throw new IllegalArgumentException("Razorpay signature is required");
        }

        try {
            JSONObject options = new JSONObject();
            options.put("razorpay_order_id", request.getProviderOrderId());
            options.put("razorpay_payment_id", request.getProviderPaymentId());
            options.put("razorpay_signature", request.getSignature());

            boolean verified = Utils.verifyPaymentSignature(options, razorpayKeySecret);

            if (!verified) {
                throw new IllegalArgumentException("Invalid Razorpay signature");
            }
        } catch (IllegalArgumentException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalArgumentException("Invalid Razorpay signature");
        }
    }

    private UserSubscription createOrExtendSubscription(User user, Plan plan) {
        LocalDateTime now = LocalDateTime.now();

        var activeSubscription = userSubscriptionRepository
                .findTopByUserIdAndStatusAndEndDateAfterOrderByEndDateDesc(
                        user.getId(),
                        UserSubscription.STATUS_ACTIVE,
                        now
                );

        if (activeSubscription.isPresent()) {
            UserSubscription subscription = activeSubscription.get();

            LocalDateTime baseEndDate = subscription.getEndDate() == null
                    ? now
                    : subscription.getEndDate();

            if (baseEndDate.isBefore(now)) {
                baseEndDate = now;
            }

            subscription.setPlanId(plan.getId());
            subscription.setStatus(UserSubscription.STATUS_ACTIVE);
            subscription.setEndDate(baseEndDate.plusDays(plan.getValidityDays()));
            subscription.setUpdatedAt(now);

            return userSubscriptionRepository.save(subscription);
        }

        UserSubscription subscription = new UserSubscription();
        subscription.setUserId(user.getId());
        subscription.setPlanId(plan.getId());
        subscription.setStatus(UserSubscription.STATUS_ACTIVE);
        subscription.setStartDate(now);
        subscription.setEndDate(now.plusDays(plan.getValidityDays()));
        subscription.setCreatedAt(now);
        subscription.setUpdatedAt(now);

        return userSubscriptionRepository.save(subscription);
    }

    public SubscriptionStatusResponse getStatus(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        var activeSubscription = userSubscriptionRepository
                .findTopByUserIdAndStatusAndEndDateAfterOrderByEndDateDesc(
                        user.getId(),
                        UserSubscription.STATUS_ACTIVE,
                        LocalDateTime.now()
                );

        var latestSuccessTransaction = paymentTransactionRepository
                .findTopByUserIdAndStatusOrderByUpdatedAtDesc(
                        user.getId(),
                        PAYMENT_STATUS_SUCCESS
                );

        if (activeSubscription.isPresent() && latestSuccessTransaction.isPresent()) {
            return new SubscriptionStatusResponse(true, activeSubscription.get().getEndDate());
        }

        return new SubscriptionStatusResponse(false, null);
    }

    public List<PaymentTransaction> getPaymentHistory(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        return paymentTransactionRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
    }
}