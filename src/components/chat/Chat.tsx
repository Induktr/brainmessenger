import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from '@supabase/supabase-js';
import { 
  Chat as ChatType, 
  Message, 
  isDatabaseChatResponse, 
  transformDatabaseChat,
  DatabaseChatResponse
} from "@/types/chat";
import { debounce } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Menu, Plus, Pin, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChatList } from "./ChatList";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";
import { ChatHeader }from  "./ChatHeader";
import { SettingsDialog } from "@/components/settings/Settings";
import { useAuth } from "@/hooks/useAuth";
import { useSession } from "@/hooks/useSession";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export const Chat = () => {
  // Core hooks
  const navigate = useNavigate();
  const { user, loading: authLoading, initialized: authInitialized } = useAuth();
  const { session, isLoading: sessionLoading } = useSession();
  const { toast } = useToast();

  // Refs for subscription cleanup
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);
  const chatChannelRef = useRef<RealtimeChannel | null>(null);
  const initializeTimeoutRef = useRef<NodeJS.Timeout>();

  // Component state
  const [state, setState] = useState({
    selectedChat: null as ChatType | null,
    isNewChatOpen: false,
    isSettingsOpen: false,
    chats: [] as ChatType[],
    messages: [] as Message[],
    searchQuery: "",
    formState: {
      isGroup: false,
      newChatName: ""
    },
    sortBy: 'latest' as 'latest' | 'active' | 'pinned' | 'unread',
    onlineUsers: new Set<string>(),
    typingUsers: {} as Record<string, boolean>,
    isLoading: false,
    error: null as string | null
  });

  // Memoized state setters
  const setSelectedChat = useCallback((chat: ChatType | null) => {
    setState(prev => ({ ...prev, selectedChat: chat }));
  }, []);

  const setIsNewChatOpen = useCallback((isOpen: boolean) => {
    setState(prev => ({ ...prev, isNewChatOpen: isOpen }));
  }, []);

  const setIsSettingsOpen = useCallback((isOpen: boolean) => {
    setState(prev => ({ ...prev, isSettingsOpen: isOpen }));
  }, []);

  // Memoized handlers
  // Debounced presence update handler
  const handlePresenceUpdate = useCallback(
    debounce((state: Record<string, any>) => {
      const onlineUserIds = new Set(
        Object.values(state)
          .flat()
          .map((presence: any) => presence.user_id)
      );
      setState(prev => ({ ...prev, onlineUsers: onlineUserIds }));
    }, 500),
    []
  );

  const handleChatUpdate = useCallback((payload: RealtimePostgresChangesPayload<DatabaseChatResponse>) => {
    // Silent return for invalid payloads
    if (!payload.new || !isDatabaseChatResponse(payload.new)) return;

    try {
      const updatedChat = transformDatabaseChat(payload.new);
      
      setState(prev => {
        const newChats = [...prev.chats];
        
        switch (payload.eventType) {
          case 'INSERT':
            newChats.push(updatedChat);
            break;
          case 'UPDATE':
            const index = newChats.findIndex(chat => chat.id === updatedChat.id);
            if (index !== -1) newChats[index] = updatedChat;
            break;
          case 'DELETE':
            return {
              ...prev,
              chats: newChats.filter(chat => chat.id !== updatedChat.id),
              selectedChat: prev.selectedChat?.id === updatedChat.id ? null : prev.selectedChat
            };
        }
        
        return {
          ...prev,
          chats: newChats,
          selectedChat: prev.selectedChat?.id === updatedChat.id ? updatedChat : prev.selectedChat
        };
      });
    } catch (error) {
      // Only show error to user for critical failures
      if (error instanceof Error && error.message !== 'AbortError') {
        toast({
          title: "Error",
          description: "Failed to process chat update. Please refresh the page.",
          variant: "destructive"
        });
      }
    }
  }, [toast]);

  const handleTypingStart = useCallback(() => {
    if (!user || !state.selectedChat) return;
    
    setState(prev => ({
      ...prev,
      typingUsers: {
        ...prev.typingUsers,
        [user.id]: true
      }
    }));
  }, [user, state.selectedChat]);

  const handleTypingStop = useCallback(() => {
    if (!user || !state.selectedChat) return;
    
    setState(prev => ({
      ...prev,
      typingUsers: {
        ...prev.typingUsers,
        [user.id]: false
      }
    }));
  }, [user, state.selectedChat]);

  const handleSendMessage = useCallback(async (content: string) => {
    if (!user || !state.selectedChat) return;

    try {
      const newMessage: Omit<Message, 'id' | 'createdAt' | 'updatedAt'> = {
        chatId: state.selectedChat.id,
        senderId: user.id,
        content,
        sender: {
          id: user.id,
          display_name: user.user_metadata?.display_name || 'Unknown User',
          avatar_url: user.user_metadata?.avatar_url,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      };

      await supabase
        .from('messages')
        .insert([newMessage])
        .select()
        .single();

      // Clear typing status after sending message
      handleTypingStop();
    } catch (error) {
      console.error('Failed to send message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive'
      });
    }
  }, [user, state.selectedChat, toast, handleTypingStop]);

  const initializeChat = useCallback(async () => {
    try {
      // Clear existing subscriptions FIRST
      const cleanup = () => {
        presenceChannelRef.current?.unsubscribe();
        chatChannelRef.current?.unsubscribe();
      };
      cleanup();
  
      // Create NEW subscriptions
      const presenceChannel = supabase.channel('online-users');
      presenceChannelRef.current = presenceChannel;
      
      // ... rest of subscription setup ...
  
    } catch (error) {
      // Error handling
    }
  }, [user?.id]); // Only depend on user ID

  // Cleanup function
  useEffect(() => {
    return () => {
      if (initializeTimeoutRef.current) {
        clearTimeout(initializeTimeoutRef.current);
      }
      if (presenceChannelRef.current) {
        presenceChannelRef.current.unsubscribe();
      }
      if (chatChannelRef.current) {
        chatChannelRef.current.unsubscribe();
      }
    };
  }, []);

  // Search and sort handlers
  const handleSearchChange = useCallback((value: string) => {
    setState(prev => ({ ...prev, searchQuery: value }));
  }, []);

  const handleSortChange = useCallback((value: 'latest' | 'active' | 'pinned' | 'unread') => {
    setState(prev => ({ ...prev, sortBy: value }));
  }, []);

  const handleCreateChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !state.formState.newChatName.trim()) return;

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const { data: newChat, error: createError } = await supabase
        .from('chats')
        .insert([
          {
            name: state.formState.newChatName.trim(),
            created_by: user.id,
            is_group: state.formState.isGroup,
            participants: [user.id],
            updated_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (createError) throw createError;

      if (isDatabaseChatResponse(newChat)) {
        const transformedChat = transformDatabaseChat(newChat);
        setState(prev => ({
          ...prev,
          chats: [transformedChat, ...prev.chats],
          selectedChat: transformedChat,
          isNewChatOpen: false,
          formState: { isGroup: false, newChatName: "" }
        }));
      }
    } catch (error) {
      if (error instanceof Error && !error.message.includes('AbortError')) {
        setState(prev => ({
          ...prev,
          error: 'Unable to create chat. Please try again.',
          isLoading: false
        }));
        toast({
          title: "Error",
          description: "Failed to create chat. Please try again.",
          variant: "destructive"
        });
      }
    }
  };

  useEffect(() => {
    const abortController = new AbortController();
  
    const initialize = async () => {
      // Early return for invalid states
      if (authLoading || sessionLoading || !authInitialized) return;
      
      // Redirect unauthenticated users immediately
      if (!user || !session) {
        navigate('/login', { replace: true });
        return;
      }
  
      try {
        await initializeChat();
      } catch (error) {
        // Error handling
      }
    };
  
    initialize();
  
    return () => {
      abortController.abort();
      // Add immediate cleanup of subscriptions
      if (presenceChannelRef.current) presenceChannelRef.current.unsubscribe();
      if (chatChannelRef.current) chatChannelRef.current.unsubscribe();
    };
  }, [user?.id, session?.access_token, authInitialized]); // Only track critical identifiers

  if (authLoading || sessionLoading || state.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary rounded-full border-t-transparent" />
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-red-500 mb-4">{state.error}</p>
        <Button
          onClick={() => {
            window.location.reload();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  // Memoize handlers to prevent unnecessary re-renders
  const memoizedHandlers = useMemo(() => ({
    onSearchChange: handleSearchChange,
    onSortChange: handleSortChange
  }), [handleSearchChange, handleSortChange]);

  return (
    <div className="flex h-screen bg-gray-100">
      <div className="flex flex-col w-80 bg-white border-r">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold">Chats</h1>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsNewChatOpen(true)}
                disabled={state.isLoading || !user}
              >
                <Plus className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSettingsOpen(true)}
              >
                <Settings className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <Input
            placeholder="Search chats..."
            value={state.searchQuery}
            onChange={(e) => setState(prev => ({ ...prev, searchQuery: e.target.value }))}
            className="w-full"
          />
          <div className="mt-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="w-full">
                  <Menu className="h-4 w-4 mr-2" />
                  Sort by: {state.sortBy}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setState(prev => ({ ...prev, sortBy: 'latest' }))}>
                  Latest
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setState(prev => ({ ...prev, sortBy: 'active' }))}>
                  Most active
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setState(prev => ({ ...prev, sortBy: 'pinned' }))}>
                  <Pin className="h-4 w-4 mr-2" />
                  Pinned
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setState(prev => ({ ...prev, sortBy: 'unread' }))}>
                  Unread
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <ChatList
          chats={state.chats}
          selectedChat={state.selectedChat}
          onSelectChat={setSelectedChat}
          onlineUsers={state.onlineUsers}
          searchQuery={state.searchQuery}
          sortBy={state.sortBy}
          {...memoizedHandlers}
        />
      </div>

      <div className="flex-1 flex flex-col">
        {state.selectedChat ? (
          <>
            <ChatHeader
              chat={state.selectedChat}
              onBack={() => setSelectedChat(null)}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
            <ChatMessages
              chat={state.selectedChat}
              messages={state.messages}
              onlineUsers={state.onlineUsers}
              typingUsers={state.typingUsers}
              isLoading={state.isLoading}
              className="flex-1"
            />
            <ChatInput
              chatId={state.selectedChat.id}
              onSendMessage={handleSendMessage}
            />

          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-500">Select a chat to start messaging</p>
          </div>
        )}
      </div>

      <Dialog open={state.isNewChatOpen} onOpenChange={setIsNewChatOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create new chat</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateChat} className="space-y-4">
            <div>
              <Label htmlFor="chatName">Chat name</Label>
              <Input
                id="chatName"
                value={state.formState.newChatName}
                onChange={(e) =>
                  setState(prev => ({
                    ...prev,
                    formState: { ...prev.formState, newChatName: e.target.value }
                  }))
                }
                placeholder="Enter chat name"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isGroup"
                checked={state.formState.isGroup}
                onChange={(e) =>
                  setState(prev => ({
                    ...prev,
                    formState: { ...prev.formState, isGroup: e.target.checked }
                  }))
                }
              />
              <Label htmlFor="isGroup">Is group chat?</Label>
            </div>
            <Button type="submit" disabled={!state.formState.newChatName.trim() || state.isLoading}>
              {state.isLoading ? 'Creating...' : 'Create Chat'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <SettingsDialog
        open={state.isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
      />
    </div>
  );
};