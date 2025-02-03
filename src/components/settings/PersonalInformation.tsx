import { useEffect, useState, useCallback, useRef } from 'react';
import { AuthApiError } from '@supabase/supabase-js';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/stores/settings';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { AvatarUpload } from './AvatarUpload';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase';
import { DebouncedInput, DebouncedTextarea } from '@/components/ui/debounced-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { debounce, DebouncedFunc } from 'lodash';

export function PersonalInformation() {
  const { user } = useAuth();
  const settings = useSettings();
  const { toast } = useToast();
  const [loadingStates, setLoadingStates] = useState({
    username: false,
    displayName: false,
    bio: false,
    visibility: false,
    avatar: false,
    initial: true, // for initial load
  });
  const [localValues, setLocalValues] = useState({
    username: settings.username || '',
    displayName: settings.displayName || '',
    bio: settings.bio || '',
    visibility: settings.visibility
  });
  const [isAvatarDialogOpen, setIsAvatarDialogOpen] = useState(false);
  const previousValuesRef = useRef(localValues);
  const debouncedFunctionsRef = useRef<{
    [key: string]: DebouncedFunc<(value: string) => Promise<void>>;
  }>({});

  // Update local values when settings change, but only if they haven't been modified locally
  useEffect(() => {
    if (loadingStates.initial) {
      setLocalValues({
        username: settings.username || '',
        displayName: settings.displayName || '',
        bio: settings.bio || '',
        visibility: settings.visibility
      });
      setLoadingStates(prev => ({ ...prev, initial: false }));
    }
    previousValuesRef.current = localValues;
  }, [settings, loadingStates.initial]);

  // Session restoration and settings initialization
  useEffect(() => {
    const initializeComponent = async () => {
      if (!user?.id) return;

      try {
        setLoadingStates(prev => ({ ...prev, initial: true }));
        // Always reload settings from server on mount
        await settings.loadSettings(user.id);

        if (!settings.username && user.email) {
          await settings.initializeFromEmail(user.email, user.id);
        }
      } catch (error) {
        console.error('Failed to initialize settings:', error);
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to load your profile settings. Please try logging out and back in.',
          variant: 'destructive',
        });
      } finally {
        setLoadingStates(prev => ({ ...prev, initial: false }));
      }
    };

    initializeComponent();

    // Set up real-time subscription for profile changes from other sessions
    const profileSubscription = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user?.id}`,
        },
        async (payload) => {
          // Only update if change came from a different session
          if (payload.new &&
              'updated_at' in payload.new &&
              payload.new.updated_at !== settings.lastUpdateTime) {
            try {
              if (user?.id) {
                // Reload settings from server to ensure consistency
                await settings.loadSettings(user.id);
              }
            } catch (error) {
              console.error('Failed to update settings after remote change:', error);
              toast({
                title: 'Sync Error',
                description: 'Failed to sync profile changes. Please refresh the page.',
                variant: 'destructive',
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      profileSubscription.unsubscribe();
    };
  }, [user?.id, settings, toast]);




  const updateField = useCallback(async (field: string, value: string) => {
    try {
      switch (field) {
        case 'username':
          await settings.setUsername(value);
          break;
        case 'displayName':
          await settings.setDisplayName(value);
          break;
        case 'bio':
          await settings.setBio(value);
          break;
        case 'visibility':
          await settings.setVisibility(value as 'public' | 'private');
          break;
      }

      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    } catch (error) {
      throw error; // Let the parent handler deal with the error
    }
  }, [settings, toast]);





  // Initialize debounced functions
  useEffect(() => {
    const createDebouncedHandler = (field: string) => 
      debounce((value: string) => updateField(field, value), 1000);

    debouncedFunctionsRef.current = {
      username: createDebouncedHandler('username'),
      displayName: createDebouncedHandler('displayName'),
      bio: createDebouncedHandler('bio'),
    };

    return () => {
      Object.values(debouncedFunctionsRef.current).forEach(fn => fn.cancel());
    };
  }, [updateField]);

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

  const createInputHandler = useCallback((field: 'username' | 'displayName' | 'bio') => 
    async (value: string) => {
      setLoadingStates(prev => ({ ...prev, [field]: true }));
      
      setLocalValues(prev => ({
        ...prev,
        [field]: value
      }));

      try {
        if (field === 'username' && !validateUsername(value)) {
          setLoadingStates(prev => ({ ...prev, [field]: false }));
          return;
        }

        await updateField(field, value);
      } catch (error: unknown) {
        if (error instanceof Error) {
          const isAuthError = error instanceof AuthApiError;
          toast({
            title: "Error",
            description: isAuthError ? 'Please log in again to continue.' : error.message,
            variant: "destructive",
          });
          
          setLocalValues(prev => ({
            ...prev,
            [field]: settings[field] || ''
          }));

          if (isAuthError) {
            // Trigger re-authentication
            window.dispatchEvent(new CustomEvent('auth:required'));
          }
        }
      } finally {
        setLoadingStates(prev => ({ ...prev, [field]: false }));
      }
    }, 
    [settings, toast, validateUsername, updateField]

  );

  const handleError = useCallback(
    (error: Error, action: string, field: string) => {
      console.error(`Failed to ${action}:`, error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : `Failed to update ${field}`,
        variant: 'destructive',
      });
      setLocalValues(prev => ({
        ...prev,
        [field]: settings[field] || ''
      }));
    },
    [settings, toast]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center space-y-4">
        <div
          onClick={() => setIsAvatarDialogOpen(true)}
          className="cursor-pointer hover:opacity-80 transition-opacity"
          role="button"
          aria-label="Change avatar"
        >
          <Avatar className="h-24 w-24">
            <AvatarImage
              src={settings.avatarUrl || undefined}
              alt={settings.displayName || "User avatar"}
            />
            <AvatarFallback>
              {settings.displayName?.[0]?.toUpperCase() || settings.email?.[0]?.toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsAvatarDialogOpen(true)}
        >
          Change Avatar
        </Button>
      </div>

      <div className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="username">Username</Label>
            <DebouncedInput
            id="username"
            value={localValues.username}
            onValueChange={createInputHandler('username')}
            disabled={loadingStates.username}
            placeholder="Enter username"
            error={false}
            />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="displayName">Display Name</Label>
            <DebouncedInput
            id="displayName"
            value={localValues.displayName}
            onValueChange={createInputHandler('displayName')}
            disabled={loadingStates.displayName}
            placeholder="Enter display name"
            error={false}
            />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="bio">Bio</Label>
            <DebouncedTextarea
            id="bio"
            value={localValues.bio}
            onValueChange={createInputHandler('bio')}
            disabled={loadingStates.bio}
            placeholder="Write something about yourself"
            error={false}
            />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="visibility">Profile Visibility</Label>
            <Select
            value={localValues.visibility}
            onValueChange={async (value: 'public' | 'private') => {
              setLoadingStates(prev => ({ ...prev, visibility: true }));
              try {
              await settings.setVisibility(value);
              setLocalValues(prev => ({ ...prev, visibility: value }));
              } catch (error: unknown) {
              if (error instanceof Error) {
                handleError(error, 'update visibility', 'visibility');
                if (error instanceof AuthApiError) {
                window.dispatchEvent(new CustomEvent('auth:required'));
                }
              }
              } finally {
              setLoadingStates(prev => ({ ...prev, visibility: false }));
              }
            }}
            disabled={loadingStates.visibility}
          >
            <SelectTrigger className={localValues.visibility === 'private' ? 'border-red-500 focus:ring-red-500' : ''}>
              <SelectValue placeholder="Select visibility" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="private">Private</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <AvatarUpload
        open={isAvatarDialogOpen}
        onOpenChange={setIsAvatarDialogOpen}
        currentAvatarUrl={settings.avatarUrl || undefined}
        onAvatarChange={async (url) => {
          try {
            await settings.setAvatarUrl(url);
            toast({
              title: "Success",
              description: "Avatar updated successfully",
            });
          } catch (error) {
            toast({
              title: "Error",
              description: error instanceof Error ? error.message : "Failed to update avatar",
              variant: "destructive",
            });
          }
        }}
        userEmail={settings.email || undefined}
      />
    </div>
  );
}