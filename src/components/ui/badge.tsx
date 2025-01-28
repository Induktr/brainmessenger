import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-neutral-background hover:bg-primary-secondary dark:bg-dark-primary dark:hover:bg-dark-secondary dark:text-dark-textPrimary",
        secondary:
          "border-transparent bg-primary-secondary text-neutral-background hover:bg-primary dark:bg-dark-secondary dark:hover:bg-dark-primary dark:text-dark-textPrimary",
        destructive:
          "border-transparent bg-accent-error text-neutral-background hover:bg-accent-error/90 dark:text-dark-textPrimary",
        outline: "text-neutral-textPrimary dark:text-dark-textPrimary border-neutral-border dark:border-dark-border",
        warning: "border-transparent bg-accent-warning text-neutral-textPrimary hover:bg-accent-warning/90 dark:text-dark-textPrimary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
