import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/types/supabase';
import { Chat, Message, ChatMember } from '@/types/chat';
import { User } from '@supabase/supabase-js';

export class ChatAPI {
  // User Management
  static async updateProfile(userId: string, updates: Partial<Database['public']['Tables']['profiles']['Update']>) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  // Chat Management
  static async createChat(chat: Omit<Chat, 'id' | 'created_at' | 'updated_at'>) {
    const { data: chatData, error: chatError } = await supabase
      .from('chats')
      .insert({
        name: chat.name,
        is_group: chat.is_group,
        created_by: chat.created_by,
        pinned: chat.pinned
      })
      .select()
      .single();

    if (chatError) throw chatError;

    // Add chat members
    if (chat.chat_members) {
      const { error: membersError } = await supabase
        .from('chat_members')
        .insert(
          chat.chat_members.map(member => ({
            chat_id: chatData.id,
            user_id: member.user_id,
            joined_at: new Date().toISOString()
          }))
        );

      if (membersError) throw membersError;
    }

    return chatData;
  }

  static async getChatsByUserId(userId: string) {
    const { data, error } = await supabase
      .from('chat_members')
      .select(`
        chat_id,
        chats (
          id,
          name,
          is_group,
          created_by,
          created_at,
          last_message,
          last_message_time,
          pinned,
          updated_at,
          chat_members (
            user_id,
            joined_at,
            last_read_time,
            profiles (
              username,
              avatar_url
            )
          )
        )
      `)
      .eq('user_id', userId);

    if (error) throw error;
    return data;
  }

  // Message Management
  static async sendMessage(message: Omit<Message, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        chat_id: message.chat_id,
        sender_id: message.sender_id,
        content: message.content,
        type: message.type,
        reactions: message.reactions
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getChatMessages(chatId: string, limit = 50, before?: string) {
    const query = supabase
      .from('messages')
      .select(`
        *,
        sender:profiles!sender_id (
          username,
          avatar_url
        )
      `)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) {
      query.lt('created_at', before);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  // Real-time subscriptions
  static subscribeToChat(chatId: string, callback: (message: Message) => void) {
    return supabase
      .channel(`chat:${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`
        },
        (payload) => {
          callback(payload.new as Message);
        }
      )
      .subscribe();
  }

  static async updateMessageReaction(messageId: string, userId: string, emoji: string, add: boolean) {
    const { data: message, error: fetchError } = await supabase
      .from('messages')
      .select('reactions')
      .eq('id', messageId)
      .single();

    if (fetchError) throw fetchError;

    const reactions = message.reactions as Record<string, string[]> || {};
    if (!reactions[emoji]) reactions[emoji] = [];

    if (add) {
      if (!reactions[emoji].includes(userId)) {
        reactions[emoji].push(userId);
      }
    } else {
      reactions[emoji] = reactions[emoji].filter(id => id !== userId);
      if (reactions[emoji].length === 0) {
        delete reactions[emoji];
      }
    }

    const { error: updateError } = await supabase
      .from('messages')
      .update({ reactions })
      .eq('id', messageId);

    if (updateError) throw updateError;
  }
}
