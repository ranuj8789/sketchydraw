package com.sketchydraw.payment.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class SubscriptionStatusResponse {
    private boolean active;
    private LocalDateTime endsAt;
}