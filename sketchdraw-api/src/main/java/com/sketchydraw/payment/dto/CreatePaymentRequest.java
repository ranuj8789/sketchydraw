package com.sketchydraw.payment.dto;

import lombok.Getter;
import lombok.Setter;
import com.sketchydraw.plan.enums.PlanCode;

@Getter
@Setter
public class CreatePaymentRequest {
    private PlanCode planCode;
}