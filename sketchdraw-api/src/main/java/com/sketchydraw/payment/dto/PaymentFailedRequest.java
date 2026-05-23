package com.sketchydraw.payment.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PaymentFailedRequest {

    private String providerOrderId;
    private String providerPaymentId;
    private String reason;
}