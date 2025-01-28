import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { Database } from '@/types/supabase';
import { ChatList } from "./ChatList";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";
import { Button } from "@/components/ui/button";
import { Menu, Plus, Settings } from "lucide-react";
import { User } from "@supabase/supabase-js";
import { 
  Chat as ChatType, 
  Message, 
  isDatabaseChatResponse, 
  transformDatabaseChat} from "@/types/chat";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { SettingsDialog } from "@/components/settings/Settings";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Users, Pin } from "lucide-react";

export const Chat = () => {
  const navigate = useNavigate();
  const [selectedChat, setSelectedChat] = useState<ChatType | null>(null);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [chats, setChats] = useState<ChatType[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [newChatName, setNewChatName] = useState("");
  const [isGroup, setIsGroup] = useState(false);
  const [sortBy, setSortBy] = useState<'latest' | 'active' | 'pinned' | 'unread'>('latest');
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    let isSubscribed = true;
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!isSubscribed) return;
      
      if (!session) {
        navigate("/login");
      } else {
        setUser(session.user);
      }
    };
    
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isSubscribed) return;
      
      if (!session) {
        navigate("/login");
      } else {
        setUser(session.user);
      }
    });

    return () => {
      isSubscribed = false;
      subscription?.unsubscribe();
    };
  }, [navigate]);

  useEffect(() => {
    if (!user) return;

    let isSubscribed = true;
    const MAX_RETRIES = 3;
    let retryCount = 0;
    const chatIds = new Set(chats.map(chat => chat.id));
    const chatChannel = supabase.channel('chat-updates');
    
    const setupSubscription = async () => {
      if (!isSubscribed) return;
      
      try {
        await chatChannel
          .on('postgres_changes', 
            { 
              event: '*', 
              schema: 'public', 
              table: 'chats',
              filter: chatIds.size > 0 ? `id=in.(${Array.from(chatIds).join(',')})` : undefined
            }, 
            () => {
              if (isSubscribed) {
                fetchChats();
              }
            }
          )
          .on('presence', { event: 'sync' }, () => {
            if (!isSubscribed) return;
            const state = chatChannel.presenceState() ?? {};
            const online = new Set(
              Object.values(state)
                .flat()
                .map((presence: { presence_ref: string }) => presence.presence_ref)
            );
            setOnlineUsers(online);
          })
          .subscribe();

        if (user?.id) {
          await chatChannel.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error('Subscription error:', error);
      }
    };

    const fetchChats = async () => {
      if (!isSubscribed || !user) return;
      
      try {
        setIsLoading(true);
        setError(null);

        const { data: memberData, error: memberError } = await supabase
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
              updated_at
            )
          `)
          .eq('profile_id', user.id)
          .order('chats(pinned)', { ascending: false })
          .order('chats(updated_at)', { ascending: false });

        if (memberError) {
          throw new Error(`Failed to fetch chat members: ${memberError.message}`);
        }

        if (!memberData) {
          throw new Error('No chat data received');
        }

        const validChats = memberData
          .filter(isDatabaseChatResponse)
          .map(transformDatabaseChat);

        if (isSubscribed) {
          setChats(validChats);
          retryCount = 0;
          setIsRetrying(false);
        }
      } catch (err) {
        console.error('Error fetching chats:', err);
        const error = err instanceof Error ? err : new Error('Unknown error occurred');
        setError(error.message);
        
        if (retryCount < MAX_RETRIES && isSubscribed) {
          const backoffTime = Math.min(1000 * Math.pow(2, retryCount), 10000);
          retryCount++;
          setIsRetrying(true);
          console.log(`Retrying in ${backoffTime}ms (attempt ${retryCount} of ${MAX_RETRIES})`);
          setTimeout(fetchChats, backoffTime);
        }
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
        }
      }
    };

    setupSubscription();

    return () => {
      isSubscribed = false;
      chatChannel?.unsubscribe();
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    
    const fetchMessages = async () => {
      if (!selectedChat) return;

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', selectedChat.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        return;
      }

      if (data) {
        setMessages(data.map(msg => ({
          ...msg,
          reactions: msg.reactions as Record<string, any> || {}
        })));
      }
    };

    if (selectedChat) {
      fetchMessages();
    }
  }, [selectedChat]);

  useEffect(() => {
    const presenceChannel = supabase.channel('online-users');
    
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const newState = presenceChannel.presenceState();
        const onlineUserIds = new Set(Object.keys(newState));
        setOnlineUsers(onlineUserIds);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && user) {
          await presenceChannel.track({ user_id: user.id });
        }
      });

    return () => {
      presenceChannel.unsubscribe();
    };
  }, [user]);

  const handleTyping = async (chatId: string, isTyping: boolean) => {
    if (!user) return () => {};
    
    const channel = supabase.channel(`typing:${chatId}`);
    if (isTyping) {
      await channel.track({ user_id: user.id, typing: true });
    }
    
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const typingState = Object.keys(state).reduce((acc, userId) => {
          acc[userId] = true;
          return acc;
        }, {} as Record<string, boolean>);
        setTypingUsers(typingState);
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  };

  const getSortedChats = () => {
    return [...chats].sort((a, b) => {
      switch (sortBy) {
        case 'latest':
          return new Date(b.last_message_time || 0).getTime() - new Date(a.last_message_time || 0).getTime();
        case 'active':
          // Remove messages length check as it's not part of the Chat type
          return 0;
        case 'pinned':
          return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
        case 'unread':
          return (b.unread_count || 0) - (a.unread_count || 0);
        default:
          return 0;
      }
    });
  };

  const handleSendMessage = async (content: string, type: 'text' | 'image' | 'audio' | 'video') => {
    if (!user || !selectedChat) return;

    const { error } = await supabase
      .from('messages')
      .insert({
        chat_id: selectedChat.id,
        sender_id: user.id,
        content,
        type
      });

    if (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleCreateChat = async () => {
    if (!user || !newChatName.trim()) return;

    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .insert({
        name: newChatName.trim(),
        is_group: isGroup,
        created_by: user.id,
        pinned: false,
        last_message: null,
        last_message_time: null
      } as Database['public']['Tables']['chats']['Insert'])
      .select()
      .single();

    if (chatError || !chat) {
      console.error('Error creating chat:', chatError);
      return;
    }

    const { error: memberError } = await supabase
      .from('chat_members')
      .insert({
        chat_id: chat.id,
        user_id: user.id
      });

    if (memberError) {
      console.error('Error adding member:', memberError);
      return;
    }

    setIsNewChatOpen(false);
    setNewChatName("");
    setIsGroup(false);
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;

    const { data: message } = await supabase
      .from('messages')
      .select('reactions')
      .eq('id', messageId)
      .single();

    if (!message) return;

    const reactions = (message.reactions as Record<string, string[]>) || {};
    const users = reactions[emoji] || [];
    const userIndex = users.indexOf(user.id);

    if (userIndex === -1) {
      reactions[emoji] = [...users, user.id];
    } else {
      reactions[emoji] = users.filter(id => id !== user.id);
      if (reactions[emoji].length === 0) {
        delete reactions[emoji];
      }
    }

    const { error } = await supabase
      .from('messages')
      .update({ reactions })
      .eq('id', messageId);

    if (error) {
      console.error('Error updating reaction:', error);
    }
  };

  const filteredChats = getSortedChats().filter(chat => 
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-64 border-r border-neutral-border bg-neutral-surface p-4 dark:border-dark-border dark:bg-dark-surface">
        <div className="p-4 border-b flex items-center justify-between">
          <h1 className="text-xl font-semibold">BrainMessenger</h1>
          <div className="flex items-center space-x-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsNewChatOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  <span>New Chat</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsSettingsOpen(true)}>
                  <Settings className="h-4 w-4 mr-2" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => supabase.auth.signOut()}>
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <ChatList
          chats={filteredChats}
          selectedChat={selectedChat?.id ?? null}
          onSelectChat={(chatId) => setSelectedChat(chats.find(c => c.id === chatId) ?? null)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          isLoading={isLoading}
          error={error}
          isRetrying={isRetrying}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="border-b border-neutral-border bg-neutral-background p-4 dark:border-dark-border dark:bg-dark-background">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold">{selectedChat.name}</h2>
                  {selectedChat.is_group && (
                    <Users className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    const { error } = await supabase
                      .from('chats')
                      .update({ pinned: !selectedChat.pinned })
                      .eq('id', selectedChat.id);
                    
                    if (error) {
                      console.error('Error updating pin status:', error);
                    }
                  }}
                >
                  <Pin className={cn("h-5 w-5", selectedChat.pinned && "text-primary")} />
                </Button>
              </div>
            </div>
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto bg-neutral-background p-4 dark:bg-dark-background">
              <ChatMessages
                messages={messages}
                currentUser={user!}
                onReaction={handleReaction}
                typingUsers={typingUsers}
                onlineUsers={onlineUsers}
              />
            </div>
            {/* Input Area */}
            <div className="border-t border-neutral-border bg-neutral-surface p-4 dark:border-dark-border dark:bg-dark-surface">
              <ChatInput 
                onSendMessage={handleSendMessage} 
                onTyping={handleTyping}
                chatId={selectedChat.id}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Select a chat to start messaging
          </div>
        )}
      </div>

      {/* New Chat Dialog */}
      <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
        <DialogContent className="bg-neutral-background border border-neutral-border">
          <DialogHeader>
            <DialogTitle>Create New Chat</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="chatName">Chat Name</Label>
              <Input
                id="chatName"
                value={newChatName}
                onChange={(e) => setNewChatName(e.target.value)}
                placeholder="Enter chat name..."
                className="bg-neutral-background border-neutral-border placeholder:text-neutral-textSecondary"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isGroup"
                checked={isGroup}
                onChange={(e) => setIsGroup(e.target.checked)}
                className="accent-green-500"
              />
              <Label htmlFor="isGroup">Is this a group chat?</Label>
            </div>
            <Button onClick={handleCreateChat} className="w-full bg-green-500 hover:bg-green-600">
              Create Chat
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <SettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
    </div>
  );
};