-- Kwader Verified Workers MVP Schema

-- 1. Workers / Skill Passports
CREATE TABLE IF NOT EXISTS public.kw_workers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Link to auth if applicable
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    city VARCHAR(100),
    years_of_experience INT DEFAULT 0,
    expected_salary DECIMAL,
    relocation_willingness BOOLEAN DEFAULT false,
    profile_visibility VARCHAR(50) DEFAULT 'Public' CHECK (profile_visibility IN ('Public', 'RecruiterOnly', 'Private')),
    qr_code_hash VARCHAR(255) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Skills Dictionary (Taxonomy)
CREATE TABLE IF NOT EXISTS public.kw_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(100) NOT NULL, -- e.g., 'CNC Laser', 'Welding'
    skill_name VARCHAR(100) NOT NULL UNIQUE, -- e.g., 'CypCut', 'Argon'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert some initial technical skills for the MVP
INSERT INTO public.kw_skills (category, skill_name) VALUES
    ('CNC Laser', 'CypCut'),
    ('CNC Laser', 'AutoCAD'),
    ('Welding', 'Argon Welding'),
    ('Welding', 'CO2 Welding'),
    ('Electrical', 'Panel Wiring'),
    ('Maintenance', 'Troubleshooting')
ON CONFLICT (skill_name) DO NOTHING;

-- 3. Worker Skills (M2M Relationship with Verification)
CREATE TABLE IF NOT EXISTS public.kw_worker_skills (
    worker_id UUID REFERENCES public.kw_workers(id) ON DELETE CASCADE,
    skill_id UUID REFERENCES public.kw_skills(id) ON DELETE CASCADE,
    skill_level INT CHECK (skill_level >= 1 AND skill_level <= 100),
    verification_status VARCHAR(50) DEFAULT 'SelfDeclared' CHECK (verification_status IN ('SelfDeclared', 'CertificateVerified', 'EmployerVerified', 'KwaderTested')),
    verified_by UUID, -- Could be a reference to a company or admin
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (worker_id, skill_id)
);

-- 4. Jobs (Source for Wage Prediction)
CREATE TABLE IF NOT EXISTS public.kw_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID, -- Reference to company table if exists
    title VARCHAR(255) NOT NULL,
    city VARCHAR(100),
    required_years_experience INT,
    actual_offered_salary DECIMAL, -- Used for dynamic wage prediction
    status VARCHAR(50) DEFAULT 'Open' CHECK (status IN ('Open', 'Closed', 'Draft')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_kw_workers_modtime
    BEFORE UPDATE ON public.kw_workers
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_kw_jobs_modtime
    BEFORE UPDATE ON public.kw_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();
