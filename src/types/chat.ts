import { Json } from '@/types/supabase';

export interface Profile {
  readonly id: string;
  readonly display_name: string;
  readonly avatar_url: string | null;
}

export interface ChatMember {
  readonly chat_id: string;
  readonly profile_id: string;
  readonly joined_at: string;
}

export interface Chat {
  id: string;
  name: string;
  is_group: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  last_message: string | null;
  last_message_time: string | null;
  pinned: boolean;
  unread_count?: number;
  chat_members?: ChatMember[];
}

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  type?: string;
  reactions?: Record<string, any>;
  is_read?: boolean;
}

// Database response types
export interface DatabaseProfile extends Profile {}

export interface DatabaseChatResponse {
  chat_id: string;
  profile_id: string;
  joined_at: string;
  profiles: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  }[];
  chats: {
    id: string;
    name: string;
    is_group: boolean;
    created_by: string;
    created_at: string;
    last_message: string | null;
    last_message_time: string | null;
    pinned: boolean;
    updated_at: string;
  }[];
}

export interface DatabaseMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  profiles?: Profile;
}

// Type guards
export function isProfile(value: unknown): value is Profile {
  if (!value || typeof value !== 'object') return false;
  return 'id' in value && 'display_name' in value;
}

export function isDatabaseProfile(value: unknown): value is DatabaseProfile {
  return isProfile(value);
}

export function isDatabaseChatResponse(value: unknown): value is DatabaseChatResponse {
  if (!value || typeof value !== 'object') return false;
  return (
    'chat_id' in value &&
    'profile_id' in value &&
    'joined_at' in value &&
    'profiles' in value &&
    'chats' in value
  );
}

export function transformDatabaseChat(dbChat: DatabaseChatResponse): Chat {
  return {
    id: dbChat.chats[0].id,
    name: dbChat.chats[0].name,
    is_group: dbChat.chats[0].is_group,
    created_by: dbChat.chats[0].created_by,
    created_at: dbChat.chats[0].created_at,
    updated_at: dbChat.chats[0].updated_at,
    last_message: dbChat.chats[0].last_message,
    last_message_time: dbChat.chats[0].last_message_time,
    pinned: dbChat.chats[0].pinned,
    chat_members: dbChat.profiles.map(profile => ({
      chat_id: dbChat.chat_id,
      profile_id: profile.id,
      joined_at: dbChat.joined_at,
    }))
  };
}
