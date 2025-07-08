-- Migration: Create managers table in backoffice_db
-- Run this manually in your backoffice database

CREATE TABLE IF NOT EXISTS managers (
    manager_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    mobile_phone VARCHAR(30),
    role VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS managers_email_idx ON managers(email);
CREATE INDEX IF NOT EXISTS managers_created_at_idx ON managers(created_at);

-- Add a comment to the table
COMMENT ON TABLE managers IS 'Admin managers who can access the admin portal';
COMMENT ON COLUMN managers.role IS 'Initially empty, can be expanded later';
