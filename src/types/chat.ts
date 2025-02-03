import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export type MessageType = 'text' | 'image' | 'audio' | 'video' | 'file';

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface DatabaseProfile extends Profile {}

export interface ChatMember {
  chat_id: string;
  profile_id: string;
  joined_at: string;
}

// Database response types (snake_case)
export interface DatabaseChatResponse {
  id: string;
  name: string;
  is_group: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  last_message: string | null;
  last_message_time: string | null;
  pinned: boolean;
  unread_count: number;
  message_count: number;
  profiles: Profile;
  chat_members: ChatMember[];
}

export interface DatabaseMessageResponse {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  type?: string;
  sender: Profile;
}

export interface Chat {
  id: string;
  name: string;
  is_group: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  last_message: string | null;
  last_message_time: Date | null;
  pinned: boolean;
  message_count: number;
  unread_count: number;
  creator: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    created_at: string;
    updated_at: string;
  };
  members: {
    chat_id: string;
    profile_id: string;
    joined_at: string;
  }[];
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  sender: Profile;
  type?: MessageType;
  reactions?: Record<string, any>;
  is_read?: boolean;
  mime_type?: string;
  file_name?: string;
  file_size?: number;
}

// Type guards
export function isProfile(value: unknown): value is Profile {
  if (!value || typeof value !== 'object') return false;
  
  const profile = value as Partial<Profile>;
  return (
    typeof profile.id === 'string' &&
    (profile.display_name === null || typeof profile.display_name === 'string') &&
    (profile.avatar_url === null || typeof profile.avatar_url === 'string') &&
    typeof profile.created_at === 'string' &&
    typeof profile.updated_at === 'string'
  );
}

export const isDatabaseChatResponse = (obj: unknown): obj is DatabaseChatResponse => {
  const chat = obj as DatabaseChatResponse;
  return (
    typeof chat === 'object' &&
    chat !== null &&
    typeof chat.id === 'string' &&
    typeof chat.name === 'string' &&
    typeof chat.is_group === 'boolean' &&
    typeof chat.created_by === 'string' &&
    typeof chat.created_at === 'string' &&
    typeof chat.updated_at === 'string' &&
    (chat.last_message === null || typeof chat.last_message === 'string') &&
    (chat.last_message_time === null || typeof chat.last_message_time === 'string') &&
    typeof chat.pinned === 'boolean' &&
    typeof chat.message_count === 'number' &&
    typeof chat.unread_count === 'number' &&
    Array.isArray(chat.chat_members)
  );
};


// Transform functions
export const transformDatabaseChat = (dbChat: DatabaseChatResponse): Chat => ({
  id: dbChat.id,
  name: dbChat.name,
  is_group: dbChat.is_group,
  created_by: dbChat.created_by,
  created_at: dbChat.created_at,
  updated_at: dbChat.updated_at,
  last_message: dbChat.last_message,
  last_message_time: dbChat.last_message_time ? new Date(dbChat.last_message_time) : null,
  pinned: dbChat.pinned,
  message_count: dbChat.message_count,
  unread_count: dbChat.unread_count,
  creator: {
    id: dbChat.profiles.id,
    display_name: dbChat.profiles.display_name,
    avatar_url: dbChat.profiles.avatar_url,
    created_at: dbChat.profiles.created_at,
    updated_at: dbChat.profiles.updated_at
  },
  members: dbChat.chat_members
});

export function transformDatabaseMessage(dbMessage: DatabaseMessageResponse): Message {
  return {
    id: dbMessage.id,
    chatId: dbMessage.chat_id,
    senderId: dbMessage.sender_id,
    content: dbMessage.content,
    createdAt: new Date(dbMessage.created_at),
    updatedAt: new Date(dbMessage.updated_at),
    sender: dbMessage.sender
  };
}

export type ChatRealtimePayload = RealtimePostgresChangesPayload<DatabaseChatResponse>;
