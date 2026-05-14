package com.sketchydraw.payment.controller;

import com.sketchydraw.payment.dto.CreatePaymentRequest;
import com.sketchydraw.payment.dto.VerifyPaymentRequest;
import com.sketchydraw.payment.service.PaymentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.Map;

@RestController
@RequestMapping("/api/payment")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class PaymentController {

    private final PaymentService paymentService;

    @PostMapping("/create")
    public ResponseEntity<?> createPayment(
            Principal principal,
            @RequestBody CreatePaymentRequest request
    ) {
        return ResponseEntity.ok(paymentService.createPayment(principal.getName(), request));
    }

    @PostMapping("/verify")
    public ResponseEntity<?> verifyPayment(
            Principal principal,
            @RequestBody VerifyPaymentRequest request
    ) {
        return ResponseEntity.ok(paymentService.verifyPayment(principal.getName(), request));
    }

    @GetMapping("/status")
    public ResponseEntity<?> status(Principal principal) {
        return ResponseEntity.ok(paymentService.getStatus(principal.getName()));
    }

    @GetMapping("/history")
    public ResponseEntity<?> history(Principal principal) {
        return ResponseEntity.ok(paymentService.getPaymentHistory(principal.getName()));
    }

    @PostMapping("/webhook")
    public ResponseEntity<?> webhook(@RequestBody String payload) {
        // TODO: Cashfree webhook verification and update status.
        return ResponseEntity.ok(Map.of("success", true));
    }
}