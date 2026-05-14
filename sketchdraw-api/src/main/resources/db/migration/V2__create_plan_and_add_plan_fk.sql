-- =========================================================
-- SketchyDraw Plan Schema + Plan Foreign Keys
-- =========================================================

CREATE TABLE IF NOT EXISTS plan (
                                    id BIGSERIAL PRIMARY KEY,

                                    code VARCHAR(80) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,

    price NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',

    active BOOLEAN DEFAULT TRUE,
    product_type VARCHAR(50) DEFAULT 'SUBSCRIPTION',

    validity_days INTEGER DEFAULT 30,
    description VARCHAR(500),

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
    );

INSERT INTO plan (
    code,
    name,
    price,
    currency,
    active,
    product_type,
    validity_days,
    description,
    created_at,
    updated_at
)
SELECT
    'SKETCHY_MONTHLY_349',
    'SketchyDraw Monthly',
    349.00,
    'INR',
    TRUE,
    'SUBSCRIPTION',
    30,
    'Save drawings, open saved diagrams, and use premium SketchyDraw features.',
    NOW(),
    NOW()
    WHERE NOT EXISTS (
    SELECT 1 FROM plan WHERE code = 'SKETCHY_MONTHLY_349'
);

ALTER TABLE user_subscription
    ADD CONSTRAINT fk_user_subscription_plan
        FOREIGN KEY (plan_id)
            REFERENCES plan(id);

ALTER TABLE payment_transaction
    ADD CONSTRAINT fk_payment_transaction_plan
        FOREIGN KEY (plan_id)
            REFERENCES plan(id);