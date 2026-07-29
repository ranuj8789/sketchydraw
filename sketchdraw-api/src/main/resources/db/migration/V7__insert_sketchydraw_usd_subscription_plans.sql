-- Disable older USD plans, if they exist.
UPDATE plan
SET active = FALSE,
    updated_at = CURRENT_TIMESTAMP
WHERE currency = 'USD'
  AND code NOT IN (
      'SKETCHY_MONTHLY_USD_9',
      'SKETCHY_6_MONTHS_USD_40',
      'SKETCHY_ANNUAL_USD_75'
  );

-- $9 monthly plan
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
VALUES (
    'SKETCHY_MONTHLY_USD_9',
    'SketchyDraw Monthly',
    9.00,
    'USD',
    TRUE,
    'SUBSCRIPTION',
    30,
    'Save drawings, open saved diagrams, and use premium SketchyDraw features.',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    price = EXCLUDED.price,
    currency = EXCLUDED.currency,
    active = EXCLUDED.active,
    product_type = EXCLUDED.product_type,
    validity_days = EXCLUDED.validity_days,
    description = EXCLUDED.description,
    updated_at = CURRENT_TIMESTAMP;

-- $40 six-month plan
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
VALUES (
    'SKETCHY_6_MONTHS_USD_40',
    'SketchyDraw 6 Months',
    40.00,
    'USD',
    TRUE,
    'SUBSCRIPTION',
    180,
    'Save drawings, open saved diagrams, and use premium SketchyDraw features for 6 months.',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    price = EXCLUDED.price,
    currency = EXCLUDED.currency,
    active = EXCLUDED.active,
    product_type = EXCLUDED.product_type,
    validity_days = EXCLUDED.validity_days,
    description = EXCLUDED.description,
    updated_at = CURRENT_TIMESTAMP;

-- $75 annual plan
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
VALUES (
    'SKETCHY_ANNUAL_USD_75',
    'SketchyDraw Annual',
    75.00,
    'USD',
    TRUE,
    'SUBSCRIPTION',
    365,
    'Save drawings, open saved diagrams, and use premium SketchyDraw features for 1 year.',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    price = EXCLUDED.price,
    currency = EXCLUDED.currency,
    active = EXCLUDED.active,
    product_type = EXCLUDED.product_type,
    validity_days = EXCLUDED.validity_days,
    description = EXCLUDED.description,
    updated_at = CURRENT_TIMESTAMP;
