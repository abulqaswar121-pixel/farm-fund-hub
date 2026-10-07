-- ============================================================================
-- NDH AGRICAPITAL — Tilapia joins the commodity catalogue
-- ----------------------------------------------------------------------------
-- Run this file ON ITS OWN, in its own transaction, exactly like
-- 20261007115900_ndh_agricapital_role_enum.sql: PostgreSQL refuses to *use* a
-- newly added enum value in the transaction that added it, so this migration
-- only adds the value and nothing else. The platform's commodity catalogue
-- (src/lib/agri/commodities.ts) starts offering tilapia once this has run.
--
-- It is additive: every existing cycle keeps the commodity it was published
-- with, and no published cycle can ever change commodity (the
-- freeze_cycle_terms() trigger rejects that).
-- ============================================================================

alter type public.commodity_type add value if not exists 'tilapia';
