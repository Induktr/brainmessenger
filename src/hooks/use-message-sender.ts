import { useState } from 'react';
import { ChatAPI } from '@/lib/api';
import { messageStore } from '@/stores/message-store';
import type { Message } from '@/types/chat';
import { useOfflineSync } from './use-offline-sync';

export function useMessageSender() {
  const [isSending, setIsSending] = useState(false);
  const isOnline = useOfflineSync();

  const sendMessage = async (message: Omit<Message, 'id' | 'created_at' | 'updated_at'>) => {
    setIsSending(true);
    
    try {
      if (isOnline) {
        // Send message directly if online
        await ChatAPI.sendMessage(message);
      } else {
        // Queue message for later if offline
        messageStore.getState().queueOfflineMessage({
          ...message,
          id: `offline-${Date.now()}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as Message);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    } finally {
      setIsSending(false);
    }
  };

  return {
    sendMessage,
    isSending,
    isOnline,
  };
}
