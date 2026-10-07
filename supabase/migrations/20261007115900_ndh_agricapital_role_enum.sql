-- ============================================================================
-- NDH AGRICAPITAL — extend the co-operative role enum
-- ----------------------------------------------------------------------------
-- The co-operative has three access levels: admin, operator and member.
-- The base schema named the third level 'contributor'; AgriCapital calls it
-- 'member'. Postgres cannot use a newly added enum value inside the same
-- transaction that adds it, so the value is added here and relied upon by the
-- migrations that follow.
-- ============================================================================

alter type public.app_role add value if not exists 'member';
