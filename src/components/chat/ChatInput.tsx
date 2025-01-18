import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Image as ImageIcon, Send, Paperclip, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSendMessage: (content: string, type: 'text' | 'image' | 'audio' | 'video') => void;
  onTyping: (chatId: string, isTyping: boolean) => Promise<() => void>;
  chatId: string;
  className?: string;
}

export const ChatInput = ({ onSendMessage, className, onTyping, chatId }: ChatInputProps) => {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newMessage = e.target.value;
    setMessage(newMessage);
    
    // Notify typing status
    if (newMessage && !typingTimeoutRef.current) {
      onTyping(chatId, true).then((resetTyping) => {
        typingTimeoutRef.current = setTimeout(() => {
          resetTyping();
          typingTimeoutRef.current = undefined;
        }, 3000);
      });
    }
  };

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message.trim(), 'text');
      setMessage('');
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        onTyping(chatId, false).then((resetTyping) => resetTyping());
        typingTimeoutRef.current = undefined;
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Handle different file types
    const type = file.type.startsWith('image/') 
      ? 'image' 
      : file.type.startsWith('video/') 
        ? 'video'
        : file.type.startsWith('audio/') 
          ? 'audio'
          : null;

    if (!type) {
      alert('Unsupported file type');
      return;
    }

    // Convert to base64 or handle file upload here
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      onSendMessage(content, type);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className={cn("flex items-end gap-2 p-4 border-t bg-background", className)}>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*,video/*,audio/*"
        onChange={handleFileSelect}
      />
      <Button
        variant="ghost"
        size="icon"
        onClick={() => fileInputRef.current?.click()}
      >
        <Paperclip className="h-5 w-5" />
      </Button>
      <Textarea
        value={message}
        onChange={handleMessageChange}
        onKeyDown={handleKeyPress}
        placeholder="Type a message..."
        className="flex-1 min-h-[2.5rem] max-h-[150px] resize-none"
        rows={1}
      />
      {message.trim() ? (
        <Button onClick={handleSend}>
          <Send className="h-5 w-5" />
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className={cn(isRecording && "text-destructive")}
          onClick={() => setIsRecording(!isRecording)}
        >
          <Mic className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
};
