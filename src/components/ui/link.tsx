import { Link as RouterLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ComponentPropsWithoutRef, forwardRef } from "react";

export interface LinkProps extends ComponentPropsWithoutRef<typeof RouterLink> {
  className?: string;
}

const Link = forwardRef<HTMLAnchorElement, LinkProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <RouterLink
        className={cn(
          "font-medium text-primary underline-offset-4 hover:underline",
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </RouterLink>
    );
  }
);

Link.displayName = "Link";

export { Link };
