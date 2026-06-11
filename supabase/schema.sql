-- Reset schema: Drop profiles table and triggers if they already exist to ensure clean slate
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create profiles table with standard text and check constraints
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'engineer' CHECK (role IN ('admin', 'manager', 'account', 'engineer', 'storekeeper')),
  email TEXT NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to read all profiles
CREATE POLICY "Allow public read access to profiles" ON public.profiles
  FOR SELECT USING (true);

-- Allow users to update their own profile
CREATE POLICY "Allow users to update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Trigger function to automatically create a profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  assigned_role text;
  input_role text;
BEGIN
  -- Extract input role from user metadata
  input_role := new.raw_user_meta_data->>'role';
  
  -- Validate against allowed roles
  IF input_role IN ('admin', 'manager', 'account', 'engineer', 'storekeeper') THEN
    assigned_role := input_role;
  ELSE
    assigned_role := 'engineer';
  END IF;

  -- Insert profile row
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'New ERP User'),
    COALESCE(new.email, ''),
    assigned_role
  );
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Safeguard: catches any exception to ensure user registration in auth.users is NEVER blocked
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for existing users (so that users signed up before this script run get their profiles)
INSERT INTO public.profiles (id, full_name, email, role, updated_at)
SELECT 
  id,
  COALESCE(raw_user_meta_data->>'full_name', 'New ERP User'),
  COALESCE(email, ''),
  COALESCE(raw_user_meta_data->>'role', 'engineer'),
  COALESCE(updated_at, now())
FROM auth.users
ON CONFLICT (id) DO NOTHING;
