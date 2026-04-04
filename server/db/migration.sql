-- ============================================
-- Event Handling Module — Supabase Migration
-- Run this in the Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================
-- USERS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- EVENTS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  registration_deadline TIMESTAMPTZ NOT NULL,
  max_team_size INT NOT NULL DEFAULT 4,
  min_team_size INT NOT NULL DEFAULT 1,
  entry_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'open', 'ongoing', 'completed')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- TEAMS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_name VARCHAR(150) NOT NULL,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  leader_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'failed', 'confirmed', 'rejected')),
  payment_id VARCHAR(255),
  razorpay_order_id VARCHAR(255),
  attended BOOLEAN DEFAULT FALSE,
  qr_token UUID UNIQUE DEFAULT uuid_generate_v4(),
  certificates_generated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_name, event_id)
);

-- =====================
-- TEAM MEMBERS (junction)
-- =====================
CREATE TABLE IF NOT EXISTS team_members (
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (team_id, user_id)
);

-- =====================
-- INDEXES
-- =====================
CREATE INDEX IF NOT EXISTS idx_teams_event ON teams(event_id);
CREATE INDEX IF NOT EXISTS idx_teams_qr ON teams(qr_token);
CREATE INDEX IF NOT EXISTS idx_teams_payment ON teams(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);

-- =====================
-- UPDATED_AT TRIGGER
-- =====================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================
-- DISABLE RLS (we manage auth via JWT, not Supabase Auth)
-- =====================
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE team_members DISABLE ROW LEVEL SECURITY;

-- =====================
-- ENHANCEMENT: New columns
-- =====================
ALTER TABLE events ADD COLUMN IF NOT EXISTS certificate_template TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS payment_qr_image TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS food_qr_token UUID UNIQUE DEFAULT uuid_generate_v4();
ALTER TABLE teams ADD COLUMN IF NOT EXISTS food_collected BOOLEAN DEFAULT FALSE;

-- Password reset columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code_expiry TIMESTAMPTZ;

-- Rule book upload
ALTER TABLE events ADD COLUMN IF NOT EXISTS rule_book TEXT;

-- =====================
-- EVENT MESSAGES (per-event chat / announcements)
-- =====================
CREATE TABLE IF NOT EXISTS event_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE event_messages DISABLE ROW LEVEL SECURITY;

-- Payment screenshot column for student-uploaded proof
ALTER TABLE teams ADD COLUMN IF NOT EXISTS payment_screenshot TEXT;

-- Ensure payment_status constraint includes 'rejected'
ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_payment_status_check;
ALTER TABLE teams ADD CONSTRAINT teams_payment_status_check CHECK (payment_status IN ('pending', 'failed', 'confirmed', 'rejected'));

-- Contact details for events
ALTER TABLE events ADD COLUMN IF NOT EXISTS contact1 TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS contact2 TEXT;

-- Team-specific private chat messages
CREATE TABLE IF NOT EXISTS team_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE team_messages DISABLE ROW LEVEL SECURITY;

-- =====================
-- SHARING POSTS (Global Instagram-style feed)
-- =====================
CREATE TABLE IF NOT EXISTS sharing_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT,
  media_url TEXT,
  media_type VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE sharing_posts DISABLE ROW LEVEL SECURITY;
