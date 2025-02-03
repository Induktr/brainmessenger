import type { Chat, Message } from '@/types/chat';
import type { Database } from '@/types/supabase';
import { supabase } from '@/lib/supabase';

export class ChatAPI {
  // User Management
  static async updateProfile(userId: string, updates: Partial<Database['public']['Tables']['profiles']['Update']>) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId as string)
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
        pinned: chat.pinned,
        last_message: chat.last_message,
        last_message_time: chat.last_message_time,
        unread_count: chat.unread_count,
        message_count: chat.message_count
      })
      .select()
      .single();

    if (chatError) throw chatError;

    if (chat.members && chat.members.length > 0) {
      const { error: membersError } = await supabase
        .from('chat_members')
        .insert(
          chat.members.map(member => ({
            chat_id: chatData.id,
            profile_id: member.profile_id,
            joined_at: new Date().toISOString()
          }))
        );

      if (membersError) throw membersError;
    }

    return chatData;
  }

  static async getChatsByUserId(userId: string): Promise<Chat[]> {
    try {
      const { data: chatMembers, error } = await supabase
        .from('chat_members')
        .select(`
          chat_id,
          profile_id,
          joined_at,
          profiles!chat_members_profile_id_fkey (
            id,
            display_name,
            avatar_url
          ),
          chats!chat_members_chat_id_fkey (
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
              chat_id,
              profile_id,
              joined_at,
              profiles (
                id,
                display_name,
                avatar_url
              )
            )
          )
        `)
        .eq('profile_id', userId);

      if (error) throw error;

      // Transform the response to match our Chat type
        return (chatMembers || []).map(member => {
        const chat = member.chats[0];
        return {
          id: chat.id,
          name: chat.name,
          is_group: chat.is_group,
          created_by: chat.created_by,
          created_at: chat.created_at,
          updated_at: chat.updated_at,
          last_message: chat.last_message || '',
          last_message_time: chat.last_message_time || '',
          pinned: chat.pinned,
          message_count: 0, // Will be updated with actual count
          unread_count: 0, // This should be calculated separately
            creator: {
            id: member.profiles[0].id,
            display_name: member.profiles[0].display_name,
            avatar_url: member.profiles[0].avatar_url,
            created_at: chat.created_at,
            updated_at: chat.updated_at
            },
          members: chat.chat_members.map(chatMember => ({
          chat_id: chatMember.chat_id,
          profile_id: chatMember.profile_id,
          joined_at: chatMember.joined_at
          }))
        };
      });
    } catch (error) {
      console.error('Error fetching chats:', error);
      throw error;
    }
  }

  // Message Management
  static async sendMessage(message: Omit<Message, 'id' | 'createdAt' | 'updatedAt'>) {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        chat_id: message.chatId,
        sender_id: message.senderId,
        content: message.content,
        type: message.type,
        reactions: message.reactions
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getChatMessages(chatId: string, limit = 50, before?: string): Promise<Message[]> {
    const query = supabase
      .from('messages')
      .select(`
        *,
        profiles:sender_profiles(
          id,
          display_name,
          avatar_url
        )
      `)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) {
      query.lt('created_at', before);
    }

    const { data: messages, error } = await query;

    if (error) throw error;
    
    // Transform the database response to match the Message type
    return (messages || []).map(msg => ({
      ...msg,
      // Extract the first profile from the array and ensure it matches Profile type
      profiles: msg.profiles && msg.profiles[0] ? {
        id: msg.profiles[0].id,
        display_name: msg.profiles[0].display_name,
        avatar_url: msg.profiles[0].avatar_url
      } : null
    })) as Message[];
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
