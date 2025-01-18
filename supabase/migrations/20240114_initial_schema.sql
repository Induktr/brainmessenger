-- Enable the necessary extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Create custom types
create type message_type as enum ('text', 'image', 'audio', 'video');

-- Create profiles table
create table if not exists public.profiles (
    id uuid references auth.users on delete cascade primary key,
    email text unique,
    username text unique,
    avatar_url text,
    updated_at timestamp with time zone,
    constraint username_length check (char_length(username) >= 3)
);

-- Create chats table
create table if not exists public.chats (
    id uuid default uuid_generate_v4() primary key,
    name text not null,
    is_group boolean default false,
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    last_message text,
    last_message_time timestamp with time zone,
    pinned boolean default false,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create chat_members table
create table if not exists public.chat_members (
    chat_id uuid references public.chats(id) on delete cascade,
    user_id uuid references public.profiles(id) on delete cascade,
    joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
    last_read_time timestamp with time zone,
    primary key (chat_id, user_id)
);

-- Create messages table
create table if not exists public.messages (
    id uuid default uuid_generate_v4() primary key,
    chat_id uuid references public.chats(id) on delete cascade not null,
    sender_id uuid references public.profiles(id) on delete set null not null,
    content text not null,
    type message_type default 'text'::message_type not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    reactions jsonb default '{}'::jsonb,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create user_sessions table for tracking active sessions
create table if not exists public.user_sessions (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    started_at timestamp with time zone default timezone('utc'::text, now()) not null,
    ended_at timestamp with time zone,
    ip_address text,
    user_agent text,
    device_info jsonb,
    end_reason text
);

-- Create user_preferences table
create table if not exists public.user_preferences (
    user_id uuid references public.profiles(id) on delete cascade primary key,
    theme text default 'light',
    notification_settings jsonb default '{"desktop": true, "email": true, "sound": true}'::jsonb,
    language text default 'en',
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create indexes for better query performance
create index if not exists idx_messages_chat_id on public.messages(chat_id);
create index if not exists idx_messages_created_at on public.messages(created_at desc);
create index if not exists idx_chat_members_user_id on public.chat_members(user_id);
create index if not exists idx_chats_updated_at on public.chats(updated_at desc);

-- Set up Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.chats enable row level security;
alter table public.chat_members enable row level security;
alter table public.messages enable row level security;
alter table public.user_sessions enable row level security;
alter table public.user_preferences enable row level security;

-- Create policies
create policy "Users can view their own profile"
    on public.profiles for select
    using (auth.uid() = id);

create policy "Users can update their own profile"
    on public.profiles for update
    using (auth.uid() = id);

create policy "Users can view chats they are members of"
    on public.chats for select
    using (
        exists (
            select 1
            from public.chat_members
            where chat_members.chat_id = id
            and chat_members.user_id = auth.uid()
        )
    );

create policy "Chat members can view messages"
    on public.messages for select
    using (
        exists (
            select 1
            from public.chat_members
            where chat_members.chat_id = messages.chat_id
            and chat_members.user_id = auth.uid()
        )
    );

create policy "Users can send messages to chats they are members of"
    on public.messages for insert
    with check (
        exists (
            select 1
            from public.chat_members
            where chat_members.chat_id = messages.chat_id
            and chat_members.user_id = auth.uid()
        )
    );

create policy "Users can manage their own sessions"
    on public.user_sessions for all
    using (user_id = auth.uid());

create policy "Users can manage their own preferences"
    on public.user_preferences for all
    using (user_id = auth.uid());

-- Create functions
create or replace function public.handle_new_message()
returns trigger as $$
begin
    update public.chats
    set
        last_message = new.content,
        last_message_time = new.created_at,
        updated_at = new.created_at
    where id = new.chat_id;
    return new;
end;
$$ language plpgsql security definer;

-- Create triggers
create trigger on_new_message
    after insert on public.messages
    for each row
    execute function public.handle_new_message();
