import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Upload } from "lucide-react";
import { storageService } from "@/services/storage";
import { useAuth } from "@/hooks/useAuth";
import { Database, RPCFunctions } from "@/types/supabase";
import { createBrowserClient } from '@supabase/ssr';

interface AvatarUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentAvatarUrl?: string;
  onAvatarChange: (url: string) => void;
  userEmail?: string;
}

export function AvatarUpload({
  open,
  onOpenChange,
  currentAvatarUrl,
  onAvatarChange,
  userEmail,
}: AvatarUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatarUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const supabaseClient = createBrowserClient<Database>(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file (JPEG or PNG)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => setPreviewUrl(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !user) return;

    try {
      setIsUploading(true);

      // Upload using storage service
      const result = await storageService.uploadAvatar(file, user.id);

      // Start a transaction to update both auth metadata and profile
      const { data: avatarUrl, error: updateError } = await supabaseClient.rpc('update_user_avatar', {
        user_id: user.id,
        new_avatar_url: result.url,
        timestamp_param: new Date().toISOString()
      } as RPCFunctions['update_user_avatar']['Args']);

      if (updateError) {
        console.error('Avatar update error:', updateError);
        throw new Error(updateError.message || 'Failed to update avatar');
      }
      
      if (!avatarUrl) {
        console.error('No avatar URL returned');
        throw new Error('Failed to update avatar: No URL returned');
      }

      // Use the returned URL from the database to ensure consistency
      onAvatarChange(avatarUrl);
      onOpenChange(false);
      toast({
        title: "Avatar updated",
        description: "Your profile picture has been updated successfully",
      });
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast({
        title: "Upload failed",
        description: "There was an error uploading your avatar. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setPreviewUrl(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[425px]"
        aria-describedby="avatar-upload-description"
      >
        <DialogHeader>
          <DialogTitle>Change Avatar</DialogTitle>
          <DialogDescription id="avatar-upload-description">
            Upload a new profile picture. Choose a JPEG or PNG file up to 5MB in
            size.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="flex items-center justify-center">
            <Avatar className="h-24 w-24">
              {previewUrl ? (
                <AvatarImage
                  src={previewUrl}
                  alt="Avatar preview"
                />
              ) : currentAvatarUrl ? (
                <AvatarImage
                  src={currentAvatarUrl}
                  alt="Current avatar"
                />
              ) : (
                <AvatarFallback>
                  {userEmail?.[0]?.toUpperCase() ?? "?"}
                </AvatarFallback>
              )}
            </Avatar>
          </div>

          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="avatar-upload">Profile Picture</Label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                aria-label="Choose avatar file"
              >
                Choose File
              </Button>
              <Button
                variant="default"
                className="w-full"
                onClick={handleUpload}
                disabled={!previewUrl || isUploading}
                aria-label="Upload selected avatar"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                  </>
                )}
              </Button>
            </div>
            <input
              id="avatar-upload"
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={handleFileSelect}
              ref={fileInputRef}
              aria-label="File input for avatar"
            />
            <p
              className="text-sm text-muted-foreground"
              id="file-requirements"
            >
              Supported formats: JPEG, PNG. Max file size: 5MB
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
