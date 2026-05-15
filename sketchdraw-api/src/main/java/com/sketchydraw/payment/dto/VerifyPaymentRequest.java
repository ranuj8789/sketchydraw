package com.sketchydraw.payment.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class VerifyPaymentRequest {
    private String providerOrderId;
    private String providerPaymentId;
    private String signature;
}
