-- Step 1: Add columns to employees
ALTER TABLE employees 
  ADD COLUMN IF NOT EXISTS employment_type text DEFAULT 'permanent',
  ADD COLUMN IF NOT EXISTS position text,
  ADD COLUMN IF NOT EXISTS national_id text,
  ADD COLUMN IF NOT EXISTS termination_date date,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS inactive_reason text;

-- Step 2: Create employee_documents table
CREATE TABLE IF NOT EXISTS employee_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  doc_type text NOT NULL DEFAULT 'other',
  doc_name text NOT NULL,
  file_url text,
  expiry_date date,
  issue_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Step 3: Indexes
CREATE INDEX IF NOT EXISTS idx_emp_docs_employee_id ON employee_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_emp_docs_company_id ON employee_documents(company_id);

-- Step 4: RLS Policy for Documents
ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'employee_documents' AND policyname = 'emp_docs_company_access'
    ) THEN
        CREATE POLICY "emp_docs_company_access" ON employee_documents
          FOR ALL USING (
            company_id IN (
              SELECT id FROM companies WHERE owner_id = auth.uid()
            )
          );
    END IF;
END $$;

-- Step 5: (مهم جداً) إنشاء مخزن (Bucket) للملفات 
INSERT INTO storage.buckets (id, name, public) VALUES ('employee-docs', 'employee-docs', true) ON CONFLICT (id) DO UPDATE SET public = true;
