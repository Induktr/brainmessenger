import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Pin, Search, MessageCircle, Bell, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { Chat as ChatType } from "@/types/chat";

interface ChatListProps {
  chats: ChatType[];
  selectedChat: ChatType | null;
  onSelectChat: (chat: ChatType) => void;
  onlineUsers?: Set<string>;
  typingUsers?: Record<string, boolean>;
  searchQuery: string;
  sortBy?: 'latest' | 'active' | 'pinned' | 'unread';
  onSearchChange?: (value: string) => void;
  onSortChange?: (value: 'latest' | 'active' | 'pinned' | 'unread') => void;
}

export const ChatList = ({
  chats,
  selectedChat,
  onSelectChat,
  onlineUsers = new Set(),
  typingUsers = {},
  searchQuery,
  sortBy = 'latest',
  onSearchChange,
  onSortChange
}: ChatListProps) => {
  // Filter chats based on search query
  const filteredChats = chats.filter(chat =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Memoize filtered and sorted chats
  const sortedChats = useMemo(() => filteredChats.sort((a, b) => {
    if (sortBy === 'pinned') {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
    }
    
    if (sortBy === 'unread') {
      if (a.unread_count > b.unread_count) return -1;
      if (a.unread_count < b.unread_count) return 1;
    }

    // Default to latest messages
    const aTime = a.last_message_time || a.created_at;
    const bTime = b.last_message_time || b.created_at;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  }), [filteredChats, sortBy]);

  return (
    <div className="flex flex-col h-full">
      <div className="space-y-4 mb-4">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="pl-8"
          />
        </div>
        
        <Select value={sortBy} onValueChange={(value: typeof sortBy) => onSortChange?.(value)}>
          <SelectTrigger>
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="latest">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Latest Messages</span>
              </div>
            </SelectItem>
            <SelectItem value="active">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                <span>Most Active</span>
              </div>
            </SelectItem>
            <SelectItem value="pinned">
              <div className="flex items-center gap-2">
                <Pin className="h-4 w-4" />
                <span>Pinned First</span>
              </div>
            </SelectItem>
            <SelectItem value="unread">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                <span>Unread First</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <ScrollArea className="flex-1">
        {sortedChats.map((chat) => {
          const isSelected = selectedChat?.id === chat.id;
          const isOnline = chat.members.some(member => onlineUsers.has(member.profile_id));
          const isTyping = Object.keys(typingUsers).some(userId =>
            chat.members.some(member => member.profile_id === userId)
          );

          return (
            <button
              key={chat.id}
              onClick={() => onSelectChat(chat)}
              className={cn(
                "w-full p-3 rounded-lg flex items-start gap-3 hover:bg-accent transition-colors",
                isSelected && "bg-accent",
                chat.pinned && "border-l-2 border-primary"
              )}
            >
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{chat.name}</span>
                  {chat.pinned && <Pin className="h-4 w-4 text-primary" />}
                  {(chat.unread_count ?? 0) > 0 && (
                    <Badge variant="secondary" className="ml-auto">
                      {chat.unread_count}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  {isTyping ? (
                    <span className="text-xs text-primary animate-pulse">
                      Typing...
                    </span>
                  ) : (
                    <span className="truncate">
                      {chat.last_message || 'No messages yet'}
                    </span>
                )}
                {chat.last_message_time && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(chat.last_message_time), { 
                      addSuffix: true,
                      includeSeconds: true 
                    })}
                  </p>
                )}
                </div>
              </div>
              {isOnline && (
                <div className="h-2 w-2 bg-green-500 rounded-full" title="Online" />
              )}
            </button>
          );
        })}
      </ScrollArea>
    </div>
  );
};
