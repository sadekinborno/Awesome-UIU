-- ============================================
-- Admin Auth + Roles (SECURE ADMIN FOUNDATION)
-- Run this in Supabase SQL Editor
-- ============================================

-- This adds a real admin gate using Supabase Auth.
-- Admin users sign in via Supabase Auth (email/password).
-- RLS can then check auth.uid() against admin_roles.

-- 1) Admin roles table
CREATE TABLE IF NOT EXISTS public.admin_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;

-- Drop & recreate policies (idempotent)
DROP POLICY IF EXISTS "Admin can read own role" ON public.admin_roles;
DROP POLICY IF EXISTS "Admins can read all roles" ON public.admin_roles;

-- Allow any authenticated user to read their own row (so UI can verify access)
CREATE POLICY "Admin can read own role"
ON public.admin_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- NOTE
-- Do NOT add an "admins can read all roles" policy that queries public.admin_roles inside
-- an admin_roles policy; Postgres will detect it as recursive under RLS.
-- If you later want an admin-only directory of roles, use a SECURITY DEFINER function/view.

-- 2) Helper function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_roles ar
    WHERE ar.user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 3) Bootstrap (manual)
-- After you create a Supabase Auth user for the admin (Dashboard → Authentication → Users),
-- add them as admin here:
--
-- INSERT INTO public.admin_roles(user_id, role)
-- VALUES ('<AUTH_USER_UUID>', 'admin')
-- ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
