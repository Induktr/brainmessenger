import { supabase } from '@/lib/supabase';
import type { Message } from '@/types/chat';
import { messageStore } from '@/stores/message-store';
import { notificationService } from './notification';

export class WebSocketService {
  private static instance: WebSocketService;
  private subscription: any;

  private constructor() {
    this.initializeSubscription();
  }

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  private initializeSubscription() {
    this.subscription = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          const newMessage = payload.new as Message;
          await this.handleNewMessage(newMessage);
        }
      )
      .subscribe();
  }

  private async handleNewMessage(message: Message) {
    // Add message to local store
    const currentState = messageStore.getState();
    messageStore.setState({
      ...currentState,
      messages: {
        ...currentState.messages,
        [message.chat_id]: [...(currentState.messages[message.chat_id] || []), message],
      }
    });

    // Show notification
    await notificationService.showMessageNotification(message);
  }

  disconnect() {
    if (this.subscription) {
      supabase.removeChannel(this.subscription);
    }
  }
}

export const websocketService = WebSocketService.getInstance();
