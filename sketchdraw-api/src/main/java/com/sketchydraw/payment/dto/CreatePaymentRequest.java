package com.sketchydraw.payment.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreatePaymentRequest {

    /*
     * Example:
     * {
     *   "planCode": "SKETCHY_6_MONTHS_249",
     *   "provider": "RAZORPAY"
     * }
     *
     * provider can be:
     * CASHFREE
     * RAZORPAY
     */
    private String planCode;

    private String provider;
}