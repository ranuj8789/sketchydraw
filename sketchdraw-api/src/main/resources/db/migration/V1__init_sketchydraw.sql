-- =========================================================
-- SketchyDraw Initial Schema
-- V1: Core tables only. Plan table will come in V2.
-- =========================================================

-- -------------------------
-- Users
-- -------------------------
CREATE TABLE IF NOT EXISTS app_user (
                                        id BIGSERIAL PRIMARY KEY,

                                        email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    full_name VARCHAR(120) NOT NULL,

    email_verified BOOLEAN NOT NULL DEFAULT FALSE,

    verification_token VARCHAR(200),
    reset_token VARCHAR(200),

    provider VARCHAR(40),
    provider_user_id VARCHAR(150),
    profile_picture_url VARCHAR(1000),

    last_login_at TIMESTAMP,
    verification_token_created_at TIMESTAMP,
    reset_token_created_at TIMESTAMP,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

-- email UNIQUE already creates an index.
-- No extra email index needed.


-- -------------------------
-- User Subscription
-- plan_id exists, but FK to plan will be added in V2
-- -------------------------
CREATE TABLE IF NOT EXISTS user_subscription (
                                                 id BIGSERIAL PRIMARY KEY,

                                                 user_id BIGINT NOT NULL,
                                                 plan_id BIGINT NOT NULL,

                                                 status VARCHAR(30) NOT NULL,

    start_date TIMESTAMP,
    end_date TIMESTAMP,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,

    CONSTRAINT fk_user_subscription_user
    FOREIGN KEY (user_id)
    REFERENCES app_user(id)
    ON DELETE CASCADE
    );


-- -------------------------
-- Payment Transactions
-- plan_id exists, but FK to plan will be added in V2
-- -------------------------
CREATE TABLE IF NOT EXISTS payment_transaction (
                                                   id BIGSERIAL PRIMARY KEY,

                                                   user_id BIGINT NOT NULL,
                                                   plan_id BIGINT NOT NULL,

                                                   amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',

    provider VARCHAR(100),
    provider_order_id VARCHAR(150),
    provider_payment_id VARCHAR(150),

    status VARCHAR(40) NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,

    CONSTRAINT fk_payment_transaction_user
    FOREIGN KEY (user_id)
    REFERENCES app_user(id)
    ON DELETE CASCADE
    );

CREATE INDEX IF NOT EXISTS idx_payment_transaction_user_id
    ON payment_transaction(user_id);


-- -------------------------
-- Saved Drawings
-- -------------------------
CREATE TABLE IF NOT EXISTS saved_drawing (
                                             id BIGSERIAL PRIMARY KEY,

                                             user_id BIGINT NOT NULL,

                                             title VARCHAR(150) NOT NULL,
    drawing_json TEXT NOT NULL,
    drawing_type VARCHAR(50) NOT NULL DEFAULT 'EXCALIDRAW',

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,

    CONSTRAINT fk_saved_drawing_user
    FOREIGN KEY (user_id)
    REFERENCES app_user(id)
    ON DELETE CASCADE
    );

CREATE INDEX IF NOT EXISTS idx_saved_drawing_user_id
    ON saved_drawing(user_id);


-- -------------------------
-- App Logs
-- -------------------------
CREATE TABLE IF NOT EXISTS app_log (
                                       id BIGSERIAL PRIMARY KEY,

                                       log_level VARCHAR(50),
    log_type VARCHAR(100),

    user_id BIGINT,
    job_id BIGINT,

    tool_name VARCHAR(255),
    endpoint VARCHAR(255),
    http_method VARCHAR(20),

    ip_address VARCHAR(100),
    user_agent VARCHAR(1000),

    correlation_id VARCHAR(255),
    session_id VARCHAR(255),

    message VARCHAR(2000),
    error_message VARCHAR(4000),

    file_size_bytes BIGINT,
    processing_time_ms BIGINT,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE INDEX IF NOT EXISTS idx_app_log_created_at
    ON app_log(created_at DESC);