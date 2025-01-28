import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Pin, Search, MessageCircle, Clock, Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface Chat {
  id: string;
  name: string;
  is_group: boolean;
  last_message: string | null;
  last_message_time: string | null;
  pinned: boolean;
  unread_count?: number;
  message_count?: number;
}

interface ChatListProps {
  chats: Chat[];
  selectedChat: string | null;
  onSelectChat: (chatId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: 'latest' | 'active' | 'pinned' | 'unread';
  onSortByChange: (sort: 'latest' | 'active' | 'pinned' | 'unread') => void;
  isLoading?: boolean;
  error?: string | null;
  isRetrying?: boolean;
}

export const ChatList = ({
  chats,
  selectedChat,
  onSelectChat,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortByChange,
  isLoading,
  error,
  isRetrying
}: ChatListProps) => {
  return (
    <div className="flex flex-col h-full">
      <div className="space-y-4 mb-4">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8"
          />
        </div>
        
        <Select value={sortBy} onValueChange={onSortByChange}>
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
      
      {error && (
        <div className="p-4 text-sm text-red-500 bg-red-50 border-b">
          <p>Error loading chats: {error}</p>
          {isRetrying && <p className="mt-1">Retrying...</p>}
        </div>
      )}

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : chats.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            No chats found
          </div>
        ) : (
          <div className="space-y-2">
            {chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                className={cn(
                  "w-full p-3 rounded-lg flex items-start gap-3 hover:bg-accent transition-colors",
                  selectedChat === chat.id && "bg-accent"
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
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {chat.last_message}
                  </p>
                  {chat.last_message_time && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(chat.last_message_time), { addSuffix: true })}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
