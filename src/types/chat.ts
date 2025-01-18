import { Json } from '@/types/supabase';

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

export interface ChatMember {
  chat_id: string;
  user_id: string;
  joined_at: string;
  user: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  };
}

export interface Chat {
  id: string;
  name: string;
  is_group: boolean;
  created_by: string;
  created_at: string;
  last_message?: string;
  last_message_time?: string;
  pinned: boolean;
  updated_at: string;
  unread_count: number;
  unread: boolean;
  chat_members: ChatMember[];
}

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  type: 'text' | 'image' | 'audio' | 'video';
  created_at: string;
  reactions: Json;  
  updated_at: string;
}

export interface MessageReaction {
  emoji: string;
  users: string[];
}

export interface DatabaseChatResponse {
  chat_id: string;
  user_id: string;
  joined_at: string;
  profiles: Profile;
  chats: Omit<Chat, 'unread_count' | 'unread' | 'chat_members'>;
}

export type DatabaseMessage = {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  deleted: boolean;
  sender?: Profile;
}

export const transformDatabaseChat = (member: DatabaseChatResponse): Chat => ({
  ...member.chats,
  unread_count: 0,
  unread: false,
  chat_members: [{
    chat_id: member.chat_id,
    user_id: member.user_id,
    joined_at: member.joined_at,
    user: {
      id: member.profiles.id,
      display_name: member.profiles.display_name,
      avatar_url: member.profiles.avatar_url
    }
  }]
});

export const mapDatabaseChatToChat = (dbChat: DatabaseChatResponse): Chat => ({
  id: dbChat.chats.id,
  name: dbChat.chats.name,
  is_group: dbChat.chats.is_group,
  created_by: dbChat.chats.created_by,
  created_at: dbChat.chats.created_at,
  last_message: dbChat.chats.last_message,
  last_message_time: dbChat.chats.last_message_time,
  pinned: dbChat.chats.pinned,
  updated_at: dbChat.chats.updated_at,
  unread_count: 0, // Default value, should be calculated elsewhere
  unread: false, // Default value, should be calculated elsewhere
  chat_members: [{
    chat_id: dbChat.chat_id,
    user_id: dbChat.user_id,
    joined_at: dbChat.joined_at,
    user: {
      id: dbChat.profiles.id,
      display_name: dbChat.profiles.display_name,
      avatar_url: dbChat.profiles.avatar_url
    }
  }]
});
