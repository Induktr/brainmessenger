import { create } from 'zustand';
import type { StateCreator } from 'zustand';
import { persist, PersistOptions } from 'zustand/middleware';
import type { Message } from '@/types/chat';
import { ChatAPI } from '@/lib/api';

interface MessageState {
  messages: Record<string, Message[]>;
  messageIds: Set<string>;
  pendingMessages: Set<string>;
  offlineMessages: Message[];
  error: Error | null;
  isLoading: boolean;
  isRetrying: boolean;
  addMessage: (message: Message) => void;
  setMessages: (chatId: string, messages: Message[]) => void;
  clearMessages: (chatId: string) => void;
  queueOfflineMessage: (message: Message) => void;
  syncOfflineMessages: () => Promise<void>;
  getMessagesForChat: (chatId: string) => Message[];
}

const createMessageStore: StateCreator<MessageState> = (set, get) => ({
  messages: {},
  messageIds: new Set<string>(),
  pendingMessages: new Set<string>(),
  offlineMessages: [],
  error: null,
  isLoading: false,
  isRetrying: false,

  addMessage: (message: Message) =>
    set((state: MessageState) => {
      // Prevent duplicate messages
      if (state.messageIds.has(message.id)) {
        return state;
      }

      // Handle race condition with pending messages
      if (state.pendingMessages.has(message.id)) {
        state.pendingMessages.delete(message.id);
      }

      const chatMessages = state.messages[message.chat_id] || [];
      const newMessageIds = new Set(state.messageIds);
      newMessageIds.add(message.id);

      // Implement message limit per chat to prevent memory issues
      const MAX_MESSAGES = 1000;
      const updatedMessages = [...chatMessages, message];
      if (updatedMessages.length > MAX_MESSAGES) {
        updatedMessages.splice(0, updatedMessages.length - MAX_MESSAGES);
      }

      return {
        ...state,
        messageIds: newMessageIds,
        messages: {
          ...state.messages,
          [message.chat_id]: updatedMessages,
        },
      };
    }),

  setMessages: (chatId: string, messages: Message[]) =>
    set((state: MessageState) => {
      const newMessageIds = new Set(state.messageIds);
      messages.forEach(msg => newMessageIds.add(msg.id));

      return {
        ...state,
        messageIds: newMessageIds,
        messages: {
          ...state.messages,
          [chatId]: messages,
        },
      };
    }),

  clearMessages: (chatId: string) =>
    set((state: MessageState) => {
      const { [chatId]: _, ...restMessages } = state.messages;
      const newMessageIds = new Set(state.messageIds);
      state.messages[chatId]?.forEach(msg => newMessageIds.delete(msg.id));

      return {
        ...state,
        messageIds: newMessageIds,
        messages: restMessages,
      };
    }),

  queueOfflineMessage: (message: Message) =>
    set((state: MessageState) => ({
      ...state,
      offlineMessages: [...state.offlineMessages, message],
    })),

  syncOfflineMessages: async () => {
    const { offlineMessages } = get();
    for (const message of offlineMessages) {
      try {
        await ChatAPI.sendMessage(message);
      } catch (error) {
        console.error('Failed to sync offline message:', error);
        return;
      }
    }
    set({ offlineMessages: [] });
  },

  getMessagesForChat: (chatId: string) => {
    const state = get();
    return state.messages[chatId] || [];
  },
});

type PersistedMessageState = {
  messages: Record<string, Message[]>;
  messageIds: string[];
  offlineMessages: Message[];
};

const persistConfig: PersistOptions<MessageState, PersistedMessageState> = {
  name: 'message-store',
  partialize: (state) => ({
    messages: state.messages,
    messageIds: Array.from(state.messageIds),
    offlineMessages: state.offlineMessages,
  }),
  onRehydrateStorage: () => (state) => {
    if (state) {
      // Convert the messageIds array back to a Set
      state.messageIds = new Set(state.messageIds);
    }
  },
};

export const messageStore = create<MessageState>()(
  persist(createMessageStore, persistConfig)
);