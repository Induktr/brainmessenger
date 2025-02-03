import { useEffect, useRef } from "react";
import { format } from "date-fns";
import { Chat, Message } from "@/types/chat";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export interface ChatMessagesProps {
  chat: Chat;
  messages: Message[];
  onlineUsers: Set<string>;
  typingUsers: Record<string, boolean>;
  isLoading?: boolean;
  className?: string;
}

export const ChatMessages = ({
  chat,
  messages,
  onlineUsers,
  typingUsers,
  isLoading = false,
  className
}: ChatMessagesProps) => {
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (isLoading) {
    return (
      <div className={cn("flex-1 flex items-center justify-center", className)}>
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className={cn("flex-1 overflow-y-auto p-4 space-y-4", className)}>
      {messages.map((message, index) => {
        const isCurrentUser = message.senderId === user?.id;
        const showAvatar = !isCurrentUser && 
          (!messages[index - 1] || messages[index - 1].senderId !== message.senderId);
        const isTyping = typingUsers[message.senderId];

        return (
          <div
            key={message.id}
            className={cn(
              "flex items-start gap-2",
              isCurrentUser && "flex-row-reverse"
            )}
          >
            {showAvatar && !isCurrentUser && (
              <Avatar className="h-8 w-8">
                <AvatarImage 
                  src={message.sender.avatar_url || undefined} 
                  alt={message.sender.display_name || 'User'} 
                />
                <AvatarFallback>
                  {(message.sender.display_name || 'U').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}
            {!showAvatar && !isCurrentUser && <div className="w-8" />}
            <div
              className={cn(
                "rounded-lg px-3 py-2 max-w-[70%]",
                isCurrentUser
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              )}
            >
              {!isCurrentUser && showAvatar && (
                <div className="flex items-center gap-1 text-xs font-medium mb-1">
                  <span>{message.sender.display_name || 'Unknown User'}</span>
                  {onlineUsers.has(message.senderId) && (
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                  )}
                </div>
              )}
              <div className="break-words">
                {message.content}
                {isTyping && <span className="ml-2 animate-pulse">...</span>}
              </div>
              <div
                className={cn(
                  "text-xs mt-1",
                  isCurrentUser
                    ? "text-primary-foreground/70"
                    : "text-muted-foreground"
                )}
              >
                {format(message.createdAt, "HH:mm")}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
};
