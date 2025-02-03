import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { debounce } from 'lodash';
import { cn } from '@/lib/utils';

interface DebouncedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onValueChange: (value: string) => Promise<void>;
  delay?: number;
  error?: boolean;
}

interface DebouncedTextAreaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  value: string;
  onValueChange: (value: string) => Promise<void>;
  delay?: number;
  error?: boolean;
}

export const DebouncedInput: React.FC<DebouncedInputProps> = ({
  value: initialValue,
  onValueChange,
  delay = 500,
  disabled = false,
  error = false,
  className,
  onFocus,
  onBlur,
  ...props
}) => {
  const [localValue, setLocalValue] = useState(initialValue);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSuccessfulValueRef = useRef<string>(initialValue);

  useEffect(() => {
    if (!isFocused && !isUpdating) {
      setLocalValue(initialValue);
      lastSuccessfulValueRef.current = initialValue;
    }
  }, [initialValue, isFocused, isUpdating]);


  const debouncedUpdate = useCallback(
    debounce(async (newValue: string) => {
      if (disabled) return;
      
      try {
        setIsUpdating(true);
        await onValueChange(newValue);
        lastSuccessfulValueRef.current = newValue;
      } catch (error: unknown) {
        // Only revert if the input hasn't changed since the failed update
        if (localValue === newValue) {
          setLocalValue(lastSuccessfulValueRef.current);
        }
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('An unknown error occurred');
      } finally {
        setIsUpdating(false);
      }
    }, delay),
    [onValueChange, delay, disabled]
  );

  useEffect(() => {
    return () => {
      debouncedUpdate.cancel();
    };
  }, [debouncedUpdate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    if (!disabled) {
      debouncedUpdate(newValue);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    if (localValue !== lastSuccessfulValueRef.current) {
      debouncedUpdate.flush();
    }
    onBlur?.(e);
  };


  return (
    <Input
      {...props}
      ref={inputRef}
      value={localValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      disabled={disabled}
      className={cn(
        className,
        isUpdating && 'opacity-70',
        error && 'border-red-500 focus-visible:ring-red-500'
      )}
    />
  );
};

export const DebouncedTextarea: React.FC<DebouncedTextAreaProps> = ({
  value: initialValue,
  onValueChange,
  delay = 500,
  disabled = false,
  error = false,
  className,
  onFocus,
  onBlur,
  ...props
}) => {
  const [localValue, setLocalValue] = useState(initialValue);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastSuccessfulValueRef = useRef<string>(initialValue);

  useEffect(() => {
    if (!isFocused && !isUpdating) {
      setLocalValue(initialValue);
      lastSuccessfulValueRef.current = initialValue;
    }
  }, [initialValue, isFocused, isUpdating]);


  const debouncedUpdate = useCallback(
    debounce(async (newValue: string) => {
      if (disabled) return;
      
      try {
        setIsUpdating(true);
        await onValueChange(newValue);
        lastSuccessfulValueRef.current = newValue;
      } catch (error: unknown) {
        if (localValue === newValue) {
          setLocalValue(lastSuccessfulValueRef.current);
        }
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('An unknown error occurred');
      } finally {
        setIsUpdating(false);
      }
    }, delay),
    [onValueChange, delay, disabled]
  );

  useEffect(() => {
    return () => {
      debouncedUpdate.cancel();
    };
  }, [debouncedUpdate]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    if (!disabled) {
      debouncedUpdate(newValue);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    setIsFocused(false);
    if (localValue !== lastSuccessfulValueRef.current) {
      debouncedUpdate.flush();
    }
    onBlur?.(e);
  };


  return (
    <Textarea
      {...props}
      ref={textareaRef}
      value={localValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      disabled={disabled || isUpdating}
      className={cn(
        className,
        isUpdating && 'opacity-70',
        error && 'border-red-500 focus-visible:ring-red-500'
      )}
    />
  );
};
