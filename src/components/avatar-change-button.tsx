import React from 'react'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'

interface AvatarChangeButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onAvatarChange?: () => void
}

export function AvatarChangeButton({
  className,
  onAvatarChange,
  ...props
}: AvatarChangeButtonProps) {
  return (
    <Button
      variant="secondary"
      className={cn(
        "bg-neutral-surface/80 text-neutral-textPrimary hover:bg-neutral-surface hover:text-neutral-textPrimary dark:bg-dark-surface/80 dark:text-dark-textPrimary dark:hover:bg-dark-surface dark:hover:text-dark-textPrimary transition-all duration-200",
        className
      )}
      onClick={onAvatarChange}
      {...props}
    >
      Change Avatar
    </Button>
  )
}
