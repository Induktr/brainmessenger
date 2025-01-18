import { useEffect } from 'react';
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

export function PersonalInformation() {
  const { user } = useAuth();
  const settings = useSettings();
  const { toast } = useToast();

  // Initialize settings from email when component mounts
  useEffect(() => {
    if (user?.email && !settings.username) {
      settings.initializeFromEmail(user.email, user.id).catch((error) => {
        console.error('Failed to initialize settings:', error);
        toast({
          title: 'Error',
          description: 'Failed to initialize settings. Please try again.',
          variant: 'destructive',
        });
      });
    }
  }, [user?.email]);

  // Load settings when user changes
  useEffect(() => {
    if (user?.id) {
      settings.loadSettings(user.id).catch((error) => {
        console.error('Failed to load settings:', error);
        toast({
          title: 'Error',
          description: 'Failed to load settings. Please try again.',
          variant: 'destructive',
        });
      });
    }
  }, [user?.id]);

  const handleError = (error: Error, action: string) => {
    console.error(`Failed to ${action}:`, error);
    toast({
      title: 'Error',
      description: `Failed to ${action}. Please try again.`,
      variant: 'destructive',
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Personal Information</h3>
        <p className="text-sm text-muted-foreground">
          Manage your personal information and how others see you
        </p>
      </div>

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
            value={settings.username}
            onChange={(e) => {
              settings.setUsername(e.target.value).catch((error) =>
                handleError(error, 'update username')
              );
            }}
            placeholder="Your username"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="displayName">Display Name</Label>
          <Input
            id="displayName"
            value={settings.displayName}
            onChange={(e) => {
              settings.setDisplayName(e.target.value).catch((error) =>
                handleError(error, 'update display name')
              );
            }}
            placeholder="How you want to be known"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            value={settings.bio}
            onChange={(e) => {
              settings.setBio(e.target.value).catch((error) =>
                handleError(error, 'update bio')
              );
            }}
            placeholder="Tell us about yourself"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="visibility">Profile Visibility</Label>
          <Select
            value={settings.visibility}
            onValueChange={(value: 'public' | 'private') => {
              settings.setVisibility(value).catch((error) =>
                handleError(error, 'update visibility')
              );
            }}
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
    </div>
  );
}
