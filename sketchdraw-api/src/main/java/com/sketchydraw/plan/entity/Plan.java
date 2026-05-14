package com.sketchydraw.plan.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "plan")
public class Plan {

    public static final String PRODUCT_TYPE_SUBSCRIPTION = "SUBSCRIPTION";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 80)
    private String code;

    private String name;

    private BigDecimal price;

    private String currency = "INR";

    private Boolean active = true;

    private String productType = PRODUCT_TYPE_SUBSCRIPTION;

    private Integer validityDays = 30;

    private String description;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public String getCurrency() {
        return currency;
    }

    public Boolean getActive() {
        return active;
    }

    public String getProductType() {
        return productType;
    }

    public Integer getValidityDays() {
        return validityDays;
    }

    public String getDescription() {
        return description;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public void setName(String name) {
        this.name = name;
    }

    public void setPrice(BigDecimal price) {
        this.price = price;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public void setActive(Boolean active) {
        this.active = active;
    }

    public void setProductType(String productType) {
        this.productType = productType;
    }

    public void setValidityDays(Integer validityDays) {
        this.validityDays = validityDays;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }
}