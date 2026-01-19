-- 1. PROFILES TABLE
-- This table extends the internal auth.users table
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  email text,
  phone text,
  linkedin_url text,
  summary text,
  profile_picture_url text,
  headline_role text,
  skills text[] default '{}',
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Users can insert their own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- 2. EDUCATION TABLE
create table public.education (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  institution text not null,
  degree text,
  field_of_study text,
  year text,
  logo_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.education enable row level security;

create policy "Users can manage their own education" on public.education
  for all using (auth.uid() = profile_id);

-- 3. EXPERIENCE TABLE
create table public.experience (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  company text not null,
  role text not null,
  dates text,
  duration text,
  location text,
  description text,
  logo_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.experience enable row level security;

create policy "Users can manage their own experience" on public.experience
  for all using (auth.uid() = profile_id);

-- 4. APPLICATIONS TABLE
create table public.applications (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  job_title text not null,
  company text not null,
  job_details jsonb not null default '{}',
  tailored_resume jsonb not null default '{}',
  status text default 'Draft',
  match_score int default 0,
  notes text,
  description text,
  about_the_role text,
  responsibilities text,
  requirements text,
  nice_to_have text,
  hq_address text,
  posted_on text,
  logo_url text,
  job_resume text,
  location text,
  employment_status text,
  experience_level text,
  job_url text,
  industries text[] default '{}',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.applications enable row level security;

create policy "Users can manage their own applications" on public.applications
  for all using (auth.uid() = profile_id);

-- 5. FUNCTION & TRIGGER FOR NEW USERS
-- Automatically create a profile when a new user signs up
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id, 
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''), 
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
