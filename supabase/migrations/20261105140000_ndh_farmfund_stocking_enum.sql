-- ============================================================================
-- NDH FARMFUND — 'stocking' joins the log types
-- ----------------------------------------------------------------------------
-- Run this file ON ITS OWN, in its own transaction, exactly like
-- 20261007115900_ndh_agricapital_role_enum.sql and the tilapia migration.
-- PostgreSQL refuses to *use* a value in the transaction that added it, and the
-- data migration that follows records the day the fingerlings went into the
-- pond — which is a stocking event, not a generic one.
--
-- It is additive. No existing log changes type; the operator portal simply
-- gains a truer word for the first entry of a cycle's life.
-- ============================================================================

alter type public.log_type add value if not exists 'stocking';
