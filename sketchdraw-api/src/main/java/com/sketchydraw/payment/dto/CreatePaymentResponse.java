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
    private String providerOrderId;
    private String cfOrderId;

    private BigDecimal amount;
    private String currency;

    /*
     * This is the main value required by Cashfree JS SDK.
     * Frontend opens checkout using this value.
     */
    private String paymentSessionId;
}
