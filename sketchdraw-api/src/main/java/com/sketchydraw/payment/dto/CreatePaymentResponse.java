package com.sketchydraw.payment.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
@AllArgsConstructor
public class CreatePaymentResponse {

    private boolean success;
    private String message;

    private Long paymentId;

    private String provider;
    private String providerOrderId;
    private String providerPaymentId;

    private String cfOrderId;

    private BigDecimal amount;
    private String currency;

    /*
     * Cashfree uses this.
     */
    private String paymentSessionId;

    /*
     * Razorpay frontend checkout needs this.
     */
    private String razorpayKeyId;
}