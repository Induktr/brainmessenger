import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/stores/settings';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { AvatarUpload } from './AvatarUpload';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase';

export function PersonalInformation() {
  const { user } = useAuth();
  const settings = useSettings();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Session restoration and settings initialization
  useEffect(() => {
    const initializeComponent = async () => {
      if (!user?.id) return;

      try {
        setIsLoading(true);
        
        // Ensure we have a valid session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('No active session found');
        }

        // Load settings
        await settings.loadSettings(user.id);
        
        // Initialize from email if needed
        if (!settings.username && user.email) {
          await settings.initializeFromEmail(user.email, user.id);
        }
      } catch (error) {
        console.error('Failed to initialize settings:', error);
        toast({
          title: 'Error',
          description: 'Failed to load your profile settings. Please try logging out and back in.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    initializeComponent();
  }, [user?.id, user?.email]);

  const handleError = (error: Error, action: string) => {
    console.error(`Failed to ${action}:`, error);
    toast({
      title: 'Error',
      description: `Failed to ${action}. Please try again.`,
      variant: 'destructive',
    });
  };

  const validateUsername = (username: string): boolean => {
    if (username.length < 3) {
      toast({
        title: 'Validation Error',
        description: 'Username must be at least 3 characters long.',
        variant: 'destructive',
      });
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateUsername(settings.username)) return;
    
    try {
      setIsLoading(true);
      
      // Verify session before saving
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: 'Session Error',
          description: 'Your session has expired. Please log in again.',
          variant: 'destructive',
        });
        return;
      }

      await settings.saveProfile();
      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });
    } catch (error) {
      handleError(error instanceof Error ? error : new Error('Failed to save profile'), 'save profile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <AvatarUpload
            open={false}
            onOpenChange={() => {}}
            currentAvatarUrl={settings.avatarUrl || undefined}
            onAvatarChange={(url) => {
              settings.setAvatarUrl(url).catch((error) => 
                handleError(error, 'update avatar')
              );
            }}
            userEmail={settings.email || undefined}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={settings.username || ""}
            onChange={(e) => settings.setUsername(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="displayName">Display Name</Label>
          <Input
            id="displayName"
            value={settings.displayName}
            onChange={(e) => settings.setDisplayName(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            value={settings.bio}
            onChange={(e) => settings.setBio(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="visibility">Profile Visibility</Label>
          <Select 
            value={settings.visibility}
            onValueChange={(value: 'public' | 'private') => settings.setVisibility(value)}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select visibility" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="private">Private</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button onClick={handleSubmit} disabled={isLoading}>
        {isLoading ? 'Saving...' : 'Save Changes'}
      </Button>
    </div>
  );
}