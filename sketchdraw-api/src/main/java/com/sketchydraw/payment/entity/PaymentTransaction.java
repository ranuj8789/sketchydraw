package com.sketchydraw.payment.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "payment_transaction")
@Getter
@Setter
public class PaymentTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;

    private Long planId;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 10)
    private String currency = "INR";

    @Column(length = 100)
    private String provider;

    @Column(length = 150)
    private String providerOrderId;

    @Column(length = 150)
    private String providerPaymentId;

    @Column(nullable = false, length = 40)
    private String status;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}