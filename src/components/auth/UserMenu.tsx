import { useState, lazy, Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Lazy load the icon
const LogOutIcon = lazy(() => import("lucide-react").then(mod => ({ 
  default: mod.LogOut 
})));

interface UserMenuProps {
  asDropdownItems?: boolean;
  className?: string;
}

export const UserMenu = ({ asDropdownItems, className }: UserMenuProps = {}) => {
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (!user) return null;

  const handleLogout = async () => {
    if (isLoggingOut) return;
    
    try {
      setIsLoggingOut(true);
      await logout();
    } catch (error) {
      console.error('Failed to logout:', error);
      setIsLoggingOut(false);
    }
  };

  if (asDropdownItems) {
    return (
      <DropdownMenuItem 
        onClick={handleLogout} 
        disabled={isLoggingOut}
        className={cn(
          "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none",
          "transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
          className
        )}
      >
        <Suspense fallback={<div className="h-4 w-4 mr-2 opacity-50" />}>
          <LogOutIcon className="h-4 w-4 mr-2" />
        </Suspense>
        <span>Logout</span>
      </DropdownMenuItem>
    );
  }

  return null;
};
