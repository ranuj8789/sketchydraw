CREATE TABLE IF NOT EXISTS drawing_group (
                                             id BIGSERIAL PRIMARY KEY,

                                             user_email VARCHAR(255) NOT NULL,
    name VARCHAR(120) NOT NULL,

    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,

    CONSTRAINT uk_drawing_group_user_name UNIQUE (user_email, name)
    );

CREATE INDEX IF NOT EXISTS idx_drawing_group_user_email
    ON drawing_group (user_email);

CREATE INDEX IF NOT EXISTS idx_drawing_group_user_updated_at
    ON drawing_group (user_email, updated_at DESC);