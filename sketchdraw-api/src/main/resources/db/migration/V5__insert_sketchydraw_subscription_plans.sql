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
    'SKETCHY_6_MONTHS_249',
    'SketchyDraw 6 Months',
    249.00,
    'INR',
    TRUE,
    'SUBSCRIPTION',
    180,
    'Save drawings, open saved diagrams, and use premium SketchyDraw features for 6 months.',
    NOW(),
    NOW()
    WHERE NOT EXISTS (
    SELECT 1 FROM plan WHERE code = 'SKETCHY_6_MONTHS_249'
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
    'SKETCHY_ANNUAL_1999',
    'SketchyDraw Annual',
    1999.00,
    'INR',
    TRUE,
    'SUBSCRIPTION',
    365,
    'Save drawings, open saved diagrams, and use premium SketchyDraw features for 1 year.',
    NOW(),
    NOW()
    WHERE NOT EXISTS (
    SELECT 1 FROM plan WHERE code = 'SKETCHY_ANNUAL_1999'
);