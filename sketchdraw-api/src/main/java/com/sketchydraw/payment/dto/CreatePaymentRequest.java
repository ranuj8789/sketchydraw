package com.sketchydraw.payment.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreatePaymentRequest {

    /*
     * Frontend sends plain DB plan code:
     * { "planCode": "SKETCHY_MONTHLY_349" }
     *
     * Do not use enum here because plans are DB-driven.
     */
    private String planCode;
}
