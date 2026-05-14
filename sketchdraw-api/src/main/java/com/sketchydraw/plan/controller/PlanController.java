package com.sketchydraw.plan.controller;

import com.sketchydraw.plan.entity.Plan;
import com.sketchydraw.plan.repository.PlanRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/plans")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class PlanController {

    private final PlanRepository planRepository;

    @GetMapping
    public List<Plan> getPlans() {
        return planRepository.findByActiveTrueOrderByPriceAsc();
    }
}