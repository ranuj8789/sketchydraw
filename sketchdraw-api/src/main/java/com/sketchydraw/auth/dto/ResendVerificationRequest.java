package com.sketchydraw.auth.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ResendVerificationRequest {
    private String email;
}