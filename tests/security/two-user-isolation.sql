-- PostgreSQL RLS contract test. This isolated fixture verifies expected per-user
-- ownership behaviour; it does not test Hatchable's managed auth layer or replace
-- endpoint-level two-account tests.
\set ON_ERROR_STOP on
BEGIN;
DROP TABLE IF EXISTS public.careerpilot_rls_fixture;
DROP ROLE IF EXISTS careerpilot_test_user;
CREATE ROLE careerpilot_test_user NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE TABLE public.careerpilot_rls_fixture (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_id TEXT NOT NULL,
  payload TEXT NOT NULL
);
ALTER TABLE public.careerpilot_rls_fixture ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.careerpilot_rls_fixture FORCE ROW LEVEL SECURITY;
CREATE POLICY careerpilot_owner_policy ON public.careerpilot_rls_fixture
  USING (owner_id = current_setting('app.user_id', true))
  WITH CHECK (owner_id = current_setting('app.user_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.careerpilot_rls_fixture TO careerpilot_test_user;
GRANT USAGE, SELECT ON SEQUENCE public.careerpilot_rls_fixture_id_seq TO careerpilot_test_user;
INSERT INTO public.careerpilot_rls_fixture(owner_id,payload) VALUES ('user-a','A secret'),('user-b','B secret');
SET LOCAL ROLE careerpilot_test_user;
SELECT set_config('app.user_id','user-a',true);
DO $$
DECLARE visible_count INTEGER; updated_count INTEGER;
BEGIN
  SELECT count(*) INTO visible_count FROM public.careerpilot_rls_fixture;
  IF visible_count <> 1 THEN RAISE EXCEPTION 'User A saw % rows, expected 1', visible_count; END IF;
  UPDATE public.careerpilot_rls_fixture SET payload='tampered' WHERE owner_id='user-b';
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count <> 0 THEN RAISE EXCEPTION 'User A modified User B row'; END IF;
  BEGIN
    INSERT INTO public.careerpilot_rls_fixture(owner_id,payload) VALUES ('user-b','forged owner');
    RAISE EXCEPTION 'Forged owner insert unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
SELECT set_config('app.user_id','user-b',true);
DO $$
DECLARE visible_count INTEGER;
BEGIN
  SELECT count(*) INTO visible_count FROM public.careerpilot_rls_fixture;
  IF visible_count <> 1 THEN RAISE EXCEPTION 'User B saw % rows, expected 1', visible_count; END IF;
END $$;
RESET ROLE;
ROLLBACK;
