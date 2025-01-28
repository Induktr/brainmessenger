import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-neutral-border bg-neutral-background px-3 py-2 text-sm text-neutral-textPrimary ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-neutral-textSecondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-dark-border dark:bg-dark-background dark:text-dark-textPrimary dark:placeholder:text-dark-textSecondary",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
