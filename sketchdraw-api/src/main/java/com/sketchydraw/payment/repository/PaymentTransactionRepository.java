package com.sketchydraw.payment.repository;

import com.sketchydraw.payment.entity.PaymentTransaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PaymentTransactionRepository extends JpaRepository<PaymentTransaction, Long> {

    Optional<PaymentTransaction> findByProviderOrderId(String providerOrderId);

    List<PaymentTransaction> findByUserIdOrderByCreatedAtDesc(Long userId);
}