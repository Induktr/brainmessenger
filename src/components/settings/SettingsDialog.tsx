import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SettingsDialog = ({ open, onOpenChange }: SettingsDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="personal" className="w-full">
          <TabsList className="w-full justify-start mb-4 bg-muted/30 p-1">
            <TabsTrigger value="personal">Personal Information</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
            <TabsTrigger value="help">Help</TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold mb-1">Personal Information</h2>
              <p className="text-muted-foreground text-sm mb-6">
                Manage your personal information and how others see you
              </p>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-2xl">
                  GO
                </div>
                <Button variant="outline">Change Avatar</Button>
              </div>
              <div className="space-y-4">
                <div>
                  <Label>Display Name</Label>
                  <Input className="mt-1.5" />
                </div>
                <div>
                  <Label>Bio</Label>
                  <Textarea className="mt-1.5" />
                </div>
                <div>
                  <Label>Profile Visibility</Label>
                  <Select defaultValue="public">
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="security" className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold mb-1">Security Settings</h2>
              <p className="text-muted-foreground text-sm mb-6">
                Manage your account security and privacy
              </p>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Two-Factor Authentication</h3>
                    <p className="text-sm text-muted-foreground">Add an extra layer of security to your account</p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Login Notifications</h3>
                    <p className="text-sm text-muted-foreground">Get notified about new login attempts</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Button variant="outline">Change Password</Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold mb-1">Notification Preferences</h2>
              <p className="text-muted-foreground text-sm mb-6">
                Choose what you want to be notified about
              </p>
              <div className="space-y-4">
                {[
                  "New Message",
                  "Mentions",
                  "Group Invites",
                  "Message Preview",
                  "Sound",
                  "Email Notifications"
                ].map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <Label>{item}</Label>
                    <Switch defaultChecked={index !== 5} />
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="preferences" className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold mb-1">Application Preferences</h2>
              <p className="text-muted-foreground text-sm mb-6">
                Customize your application experience
              </p>
              <div className="space-y-4">
                <div>
                  <Label>Language</Label>
                  <Select defaultValue="en">
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="English (English)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English (English)</SelectItem>
                      <SelectItem value="es">Español (Spanish)</SelectItem>
                      <SelectItem value="fr">Français (French)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Theme</Label>
                  <Select defaultValue="system">
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="System" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="system">System</SelectItem>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Font Size</Label>
                  <Select defaultValue="medium">
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Medium" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="help" className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold mb-1">Help & Support</h2>
              <p className="text-muted-foreground text-sm mb-6">
                Find answers to common questions and get support
              </p>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4">Frequently Asked Questions</h3>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">How do I change my password?</h4>
                      <p className="text-sm text-muted-foreground">
                        Go to Security settings and click on "Change Password" button. Follow the prompts to set a new password.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">How do I enable two-factor authentication?</h4>
                      <p className="text-sm text-muted-foreground">
                        Navigate to Security settings and toggle on Two-Factor Authentication. You'll be guided through the setup process.
                      </p>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-2">Need More Help?</h3>
                  <p className="text-sm text-muted-foreground mb-4">Contact our support team for assistance</p>
                  <Button variant="default">Contact Support</Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};