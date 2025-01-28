-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- Drop existing policies if they exist
drop policy if exists "Public profiles are viewable by everyone" on profiles;
drop policy if exists "Users can view own profile" on profiles;
drop policy if exists "Users can update own profile" on profiles;
drop policy if exists "Users can create their own profile" on profiles;

-- Drop existing table if it exists
drop table if exists public.profiles;

-- Create profiles table with proper constraints
create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text,
    username text unique,
    display_name text,
    avatar_url text,
    bio text default '',
    visibility text check (visibility in ('public', 'private')) default 'public',
    updated_at timestamptz default now(),
    created_at timestamptz default now()
);

-- Add RLS policies
alter table public.profiles enable row level security;

-- Policy for viewing public profiles
create policy "Public profiles are viewable by everyone"
    on public.profiles for select
    using (visibility = 'public');

-- Policy for users to view their own profile
create policy "Users can view own profile"
    on public.profiles for select
    using (auth.uid() = id);

-- Policy for users to update their own profile
create policy "Users can update own profile"
    on public.profiles for update
    using (auth.uid() = id)
    with check (auth.uid() = id);

-- Policy for profile creation
create policy "Users can create their own profile"
    on public.profiles for insert
    with check (auth.uid() = id);

-- Grant table permissions
grant select, insert, update on public.profiles to authenticated;

-- Function to get table information
create or replace function public.get_table_info(table_name text)
returns table (
    column_name text,
    data_type text,
    is_nullable boolean,
    column_default text
)
security definer
set search_path = public
as $$
begin
    return query
    select 
        c.column_name::text,
        c.data_type::text,
        c.is_nullable::boolean,
        c.column_default::text
    from information_schema.columns c
    where c.table_schema = 'public'
        and c.table_name = $1;
end;
$$ language plpgsql;

-- Function to get foreign key information
create or replace function public.get_foreign_keys(table_name text)
returns table (
    column_name text,
    foreign_table_name text,
    foreign_schema_name text,
    foreign_column_name text
)
security definer
set search_path = public
as $$
begin
    return query
    select
        kcu.column_name::text,
        ccu.table_name::text as foreign_table_name,
        ccu.table_schema::text as foreign_schema_name,
        ccu.column_name::text as foreign_column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
        on tc.constraint_name = kcu.constraint_name
        and tc.table_schema = kcu.table_schema
    join information_schema.constraint_column_usage ccu
        on ccu.constraint_name = tc.constraint_name
        and ccu.table_schema = tc.table_schema
    where tc.constraint_type = 'FOREIGN KEY'
        and tc.table_schema = 'public'
        and tc.table_name = $1;
end;
$$ language plpgsql;

-- Grant execute permissions to authenticated users
grant execute on function public.get_table_info(text) to authenticated;
grant execute on function public.get_foreign_keys(text) to authenticated;