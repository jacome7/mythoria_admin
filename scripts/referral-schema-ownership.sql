-- Ownership-only migration: credits are managed by mythoria-webapp in mythoria_db.
-- Remove them from Admin's generated schema snapshot without dropping any existing
-- backoffice table or data. The legacy author_credit_balances table is preserved.
SELECT 1;
