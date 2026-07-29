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
    'SKETCHY_MONTHLY_USD_8',
    'SketchyDraw Pro Monthly',
    8.00,
    'USD',
    TRUE,
    'SUBSCRIPTION',
    30,
    'Save drawings, open saved diagrams, use premium SketchyDraw features, and export without a watermark.',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
    WHERE NOT EXISTS (
    SELECT 1
    FROM plan
    WHERE code = 'SKETCHY_MONTHLY_USD_8'
);