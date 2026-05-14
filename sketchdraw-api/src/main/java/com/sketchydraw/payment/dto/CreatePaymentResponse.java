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
    private BigDecimal amount;
    private String currency;
}