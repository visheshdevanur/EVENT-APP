-- ============================================
-- Multi-Tier RBAC & Departments Migration
-- ============================================

-- 1. Create Departments Table
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger for departments updated_at
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. Modify Users Table
-- First drop the old role check constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
-- Add the new constraint allowing superadmin and dept_admin
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('student', 'admin', 'dept_admin', 'superadmin'));

-- Add department reference (nullable because superadmin doesn't need a department)
ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL;

-- 3. Modify Rooms Table
-- Add department_id to associate room with its department
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE CASCADE;

-- Modify room requests to track approval from Dept Admin
-- Let's just use the existing `status` ('pending', 'approved', 'rejected').
ALTER TABLE room_requests ADD COLUMN IF NOT EXISTS department_admin_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- 4. Modify Events Table
-- Add department_id so events belong to a department
ALTER TABLE events ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE CASCADE;

-- 5. Activity Logs Table
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure RLS is disabled for the new tables (Express handles auth)
ALTER TABLE departments DISABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs DISABLE ROW LEVEL SECURITY;
