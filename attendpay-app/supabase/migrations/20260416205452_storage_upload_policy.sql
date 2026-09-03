-- Step 1: Storage Objects Bucket Policies
DO $$
BEGIN
    -- Allow public read access to the employee-docs bucket
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Allow public read access on employee-docs'
    ) THEN
        CREATE POLICY "Allow public read access on employee-docs" ON storage.objects
          FOR SELECT
          USING (bucket_id = 'employee-docs');
    END IF;

    -- Allow authenticated users to upload files to employee-docs bucket
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Allow authenticated users to upload to employee-docs'
    ) THEN
        CREATE POLICY "Allow authenticated users to upload to employee-docs" ON storage.objects
          FOR INSERT
          TO authenticated
          WITH CHECK (bucket_id = 'employee-docs');
    END IF;
    
    -- Allow authenticated users to update/delete their own uploads if needed
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Allow authenticated users to update employee-docs'
    ) THEN
        CREATE POLICY "Allow authenticated users to update employee-docs" ON storage.objects
          FOR UPDATE
          TO authenticated
          USING (bucket_id = 'employee-docs');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Allow authenticated users to delete employee-docs'
    ) THEN
        CREATE POLICY "Allow authenticated users to delete employee-docs" ON storage.objects
          FOR DELETE
          TO authenticated
          USING (bucket_id = 'employee-docs');
    END IF;
END $$;
