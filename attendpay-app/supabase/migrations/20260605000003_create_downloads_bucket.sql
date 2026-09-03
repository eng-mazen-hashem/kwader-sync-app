-- Migration: Create downloads storage bucket and policies
-- Ensure the 'downloads' bucket exists and is public
INSERT INTO storage.buckets (id, name, public) 
VALUES ('downloads', 'downloads', true) 
ON CONFLICT (id) DO UPDATE SET public = true;

-- Policies for public access and super admin writes
-- Allow anyone to read files from 'downloads' bucket
DROP POLICY IF EXISTS "Allow public read access on downloads" ON storage.objects;
CREATE POLICY "Allow public read access on downloads" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'downloads');

-- Allow super admins to manage files in 'downloads' bucket (INSERT/UPDATE/DELETE/ALL)
DROP POLICY IF EXISTS "Allow super admins to manage downloads" ON storage.objects;
CREATE POLICY "Allow super admins to manage downloads" ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'downloads' AND 
    EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid())
  )
  WITH CHECK (
    bucket_id = 'downloads' AND 
    EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid())
  );
