package com.sketchydraw.plan.repository;

import com.sketchydraw.plan.entity.Plan;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PlanRepository extends JpaRepository<Plan, Long> {

    List<Plan> findByActiveTrueOrderByPriceAsc();

    List<Plan> findByActiveTrueAndProductTypeOrderByPriceAsc(String productType);

    Optional<Plan> findByCodeAndActiveTrue(String code);
}