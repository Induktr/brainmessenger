import { StorageProvider } from "./types";
import { SupabaseStorageProvider } from "./providers/supabase";
// import { CloudinaryStorageProvider } from "./providers/cloudinary";

// Default configuration
const DEFAULT_OPTIONS = {
  maxSizeMB: 1,
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.8,
  allowedTypes: ["image/jpeg", "image/png"],
};

class StorageService {
  private provider: StorageProvider;
  private options: typeof DEFAULT_OPTIONS;

  constructor(provider: StorageProvider, options = DEFAULT_OPTIONS) {
    this.provider = provider;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  setProvider(provider: StorageProvider) {
    this.provider = provider;
  }

  setOptions(options: Partial<typeof DEFAULT_OPTIONS>) {
    this.options = { ...this.options, ...options };
  }

  async uploadAvatar(file: File, userId: string) {
    // Validate file type
    if (!this.options.allowedTypes.includes(file.type)) {
      throw new Error(
        `Invalid file type. Allowed types: ${this.options.allowedTypes.join(", ")}`
      );
    }

    // Generate path
    const ext = file.name.split(".").pop() || "jpg";
    const path = `avatars/${userId}/${Date.now()}.${ext}`;

    try {
      const result = await this.provider.uploadImage(file, path, this.options);

      // Delete old avatar if exists
      // This could be implemented based on your requirements

      return result;
    } catch (error) {
      console.error("Error uploading avatar:", error);
      throw error;
    }
  }

  async deleteAvatar(url: string) {
    try {
      await this.provider.deleteImage(url);
    } catch (error) {
      console.error("Error deleting avatar:", error);
      throw error;
    }
  }

  getImageUrl(path: string) {
    return this.provider.getImageUrl(path);
  }
}

// Create instances with different providers
export const supabaseStorage = new StorageService(
  new SupabaseStorageProvider("user-content")
);

// Cloudinary instance (commented out as it requires configuration)
/*
export const cloudinaryStorage = new StorageService(
  new CloudinaryStorageProvider(
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!,
    process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!
  )
);
*/

// Export default storage service (using Supabase)
export const storageService = supabaseStorage;
