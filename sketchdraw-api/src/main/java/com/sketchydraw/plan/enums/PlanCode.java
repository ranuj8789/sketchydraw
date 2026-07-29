package com.sketchydraw.plan.enums;

public enum PlanCode {

    SKETCHY_MONTHLY_349("SKETCHY_MONTHLY_349"),
    SKETCHY_6_MONTHS_1494("SKETCHY_6_MONTHS_1494"),
    SKETCHY_ANNUAL_1999("SKETCHY_ANNUAL_1999"),

    SKETCHY_MONTHLY_USD_9("SKETCHY_MONTHLY_USD_9"),
    SKETCHY_6_MONTHS_USD_40("SKETCHY_6_MONTHS_USD_40"),
    SKETCHY_ANNUAL_USD_75("SKETCHY_ANNUAL_USD_75");

    private final String code;

    PlanCode(String code) {
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
