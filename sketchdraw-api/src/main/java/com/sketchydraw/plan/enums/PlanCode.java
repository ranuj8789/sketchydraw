package com.sketchydraw.plan.enums;

public enum PlanCode {

    SKETCHY_MONTHLY_349("SKETCHY_MONTHLY_349"),
    SKETCHY_MONTHLY_USD_4("SKETCHY_MONTHLY_USD_4");

    private final String code;

    PlanCode(String code) {
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}