import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Paperclip, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MessageType } from '@/types/chat';

interface ChatInputProps {
  chatId: string;
  onSendMessage: (content: string) => Promise<void>;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  className?: string;
}

export const ChatInput = ({
  chatId,
  onSendMessage,
  onTypingStart,
  onTypingStop,
  className
}: ChatInputProps) => {

  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const content = e.target.value;
    setMessage(content);

    if (content && onTypingStart) {
      onTypingStart();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        onTypingStop?.();
      }, 1000);
    } else if (!content && onTypingStop) {
      onTypingStop();
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    await onSendMessage(message.trim());
    setMessage('');
    onTypingStop?.();
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      onSendMessage?.(content);
    };
    reader.readAsDataURL(file);
  };


  return (
    <div className={cn('flex items-end space-x-2 p-4', className)}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*,audio/*,video/*,application/*"
      />
      
      <Button
        variant="ghost"
        size="icon"
        onClick={handleFileSelect}
        className="flex-shrink-0"
      >
        <Paperclip className="h-5 w-5" />
      </Button>

      <Textarea
        value={message}
        onChange={handleMessageChange}
        onKeyPress={handleKeyPress}
        placeholder="Type a message..."
        className="min-h-[80px] flex-1"
      />

      <div className="flex-shrink-0 space-x-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsRecording(!isRecording)}
          className={cn(isRecording && 'text-red-500')}
        >
          <Mic className="h-5 w-5" />
        </Button>

        <Button onClick={handleSendMessage} disabled={!message.trim()}>
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};
