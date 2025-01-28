import { useState } from 'react';
import { UserSettings, SUPPORTED_LANGUAGES } from '@/types/settings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Settings as SettingsIcon } from 'lucide-react';
import { useAuth } from "@/hooks/useAuth";
import { AvatarUpload } from "./AvatarUpload";
import { PersonalInformation } from "./PersonalInformation";

interface SettingsDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>({
    personalInfo: {
      displayName: '',
      email: '',
      avatarUrl: '',
      bio: '',
      profileVisibility: 'public',
    },
    security: {
      twoFactorEnabled: false,
      lastPasswordChange: '',
      loginNotifications: true,
    },
    notifications: {
      newMessage: true,
      mentions: true,
      groupInvites: true,
      messagePreview: true,
      sound: true,
      emailNotifications: false,
    },
    preferences: {
      language: 'en',
      theme: 'system',
      fontSize: 'medium',
      messageAlignment: 'left',
      clockFormat: '24h',
    },
  });

  const [isAvatarDialogOpen, setIsAvatarDialogOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user?.user_metadata?.avatar_url);

  const handleSettingChange = (
    section: keyof UserSettings,
    setting: string,
    value: any
  ) => {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [setting]: value,
      },
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <SettingsIcon className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl" aria-describedby="settings-description">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription id="settings-description">
            Manage your account settings and preferences
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          <Tabs defaultValue="personal" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="personal" className="flex-1">Personal Information</TabsTrigger>
              <TabsTrigger value="security" className="flex-1">Security</TabsTrigger>
              <TabsTrigger value="notifications" className="flex-1">Notifications</TabsTrigger>
              <TabsTrigger value="preferences" className="flex-1">Preferences</TabsTrigger>
              <TabsTrigger value="help" className="flex-1">Help</TabsTrigger>
            </TabsList>

            <TabsContent value="personal">
              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>
                    Manage your personal information and how others see you
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PersonalInformation />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security">
              <Card>
                <CardHeader>
                  <CardTitle>Security Settings</CardTitle>
                  <CardDescription>
                    Manage your account security and privacy
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Two-Factor Authentication</Label>
                      <div className="text-sm text-muted-foreground">
                        Add an extra layer of security to your account
                      </div>
                    </div>
                    <Switch
                      checked={settings.security.twoFactorEnabled}
                      onCheckedChange={(checked) =>
                        handleSettingChange('security', 'twoFactorEnabled', checked)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Login Notifications</Label>
                      <div className="text-sm text-muted-foreground">
                        Get notified about new login attempts
                      </div>
                    </div>
                    <Switch
                      checked={settings.security.loginNotifications}
                      onCheckedChange={(checked) =>
                        handleSettingChange('security', 'loginNotifications', checked)
                      }
                    />
                  </div>

                  <Button variant="outline">Change Password</Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notifications">
              <Card>
                <CardHeader>
                  <CardTitle>Notification Preferences</CardTitle>
                  <CardDescription>
                    Choose what you want to be notified about
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(settings.notifications).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </Label>
                      </div>
                      <Switch
                        checked={value}
                        onCheckedChange={(checked) =>
                          handleSettingChange('notifications', key, checked)
                        }
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="preferences">
              <Card>
                <CardHeader>
                  <CardTitle>Application Preferences</CardTitle>
                  <CardDescription>
                    Customize your application experience
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="language">Language</Label>
                    <Select
                      value={settings.preferences.language}
                      onValueChange={(value) =>
                        handleSettingChange('preferences', 'language', value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPORTED_LANGUAGES.map((lang) => (
                          <SelectItem key={lang.code} value={lang.code}>
                            {lang.name} ({lang.nativeName})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="theme">Theme</Label>
                    <Select
                      value={settings.preferences.theme}
                      onValueChange={(value) =>
                        handleSettingChange('preferences', 'theme', value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fontSize">Font Size</Label>
                    <Select
                      value={settings.preferences.fontSize}
                      onValueChange={(value) =>
                        handleSettingChange('preferences', 'fontSize', value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Small</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="large">Large</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="help">
              <Card>
                <CardHeader>
                  <CardTitle>Help & Support</CardTitle>
                  <CardDescription>
                    Find answers to common questions and get support
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Frequently Asked Questions</h3>
                    
                    <div className="space-y-2">
                      <h4 className="font-medium">How do I change my password?</h4>
                      <p className="text-sm text-muted-foreground">
                        Go to Security settings and click on "Change Password" button.
                        Follow the prompts to set a new password.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium">How do I enable two-factor authentication?</h4>
                      <p className="text-sm text-muted-foreground">
                        Navigate to Security settings and toggle on Two-Factor Authentication.
                        You'll be guided through the setup process.
                      </p>
                    </div>

                    <div className="mt-6">
                      <h3 className="text-lg font-semibold mb-2">Need More Help?</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Contact our support team for assistance
                      </p>
                      <Button>Contact Support</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
      <AvatarUpload
        open={isAvatarDialogOpen}
        onOpenChange={setIsAvatarDialogOpen}
        currentAvatarUrl={avatarUrl}
        onAvatarChange={setAvatarUrl}
        userEmail={user?.email}
      />
    </Dialog>
  );
}
