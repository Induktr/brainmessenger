import { useEffect, useRef, useState } from 'react';
import { Message } from '@/types/chat';
import { User } from '@supabase/supabase-js';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Smile, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMessagesProps {
  messages: Message[];
  currentUser: User;
  onReaction: (messageId: string, emoji: string) => Promise<void>;
  className?: string;
  typingUsers: Record<string, boolean>;
  onlineUsers: Set<string>;
}

export const ChatMessages = ({
  messages,
  currentUser,
  onReaction,
  className,
  typingUsers,
  onlineUsers
}: ChatMessagesProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [reactionMessage, setReactionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const renderMessageContent = (message: Message) => {
    switch (message.type) {
      case 'image':
        return (
          <img 
            src={message.content} 
            alt="Message attachment" 
            className="max-w-[300px] rounded-lg"
          />
        );
      case 'video':
        return (
          <video 
            src={message.content} 
            controls 
            className="max-w-[300px] rounded-lg"
          />
        );
      case 'audio':
        return (
          <audio 
            src={message.content} 
            controls 
            className="max-w-[300px]"
          />
        );
      default:
        return <p className="text-sm">{message.content}</p>;
    }
  };

  const renderReactions = (message: Message) => {
    if (!message.reactions) return null;
    
    const reactions = message.reactions as Record<string, string[]>;
    return (
      <div className="flex gap-1 mt-1">
        {Object.entries(reactions).map(([emoji, users]) => (
          <Button
            key={emoji}
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 py-1"
            onClick={() => onReaction(message.id, emoji)}
          >
            <span className="mr-1">{emoji}</span>
            <span className="text-xs">{users.length}</span>
          </Button>
        ))}
      </div>
    );
  };

  return (
    <ScrollArea ref={scrollRef} className={cn("flex-1 p-4", className)}>
      <div className="space-y-4">
        {messages.map((message) => {
          const isOwn = message.sender_id === currentUser.id;
          
          return (
            <div
              key={message.id}
              className={cn(
                "flex flex-col",
                isOwn ? "items-end" : "items-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[70%] rounded-lg p-3",
                  isOwn ? "bg-primary text-primary-foreground" : "bg-muted"
                )}
              >
                {renderMessageContent(message)}
                {renderReactions(message)}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => onReaction(message.id, '👍')}
                >
                  <Smile className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
        {Object.keys(typingUsers).length > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm text-muted-foreground animate-pulse">
              {Object.keys(typingUsers)
                .filter(id => id !== currentUser.id)
                .map(id => onlineUsers.has(id) ? id : null)
                .filter(Boolean)
                .join(", ")} {Object.keys(typingUsers).length === 1 ? "is" : "are"} typing...
            </span>
          </div>
        )}
      </div>
    </ScrollArea>
  );
};
