import { supabase } from "@/lib/supabase";
import { StorageProvider, ImageUploadOptions, ImageUploadResult } from "../types";
import imageCompression from "browser-image-compression";

export class SupabaseStorageProvider implements StorageProvider {
  private bucket: string;
  private bucketValidated: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(bucket: string = "user-content") {
    this.bucket = bucket;
    // Initialize bucket validation on construction
    this.initializationPromise = this.initializeBucket();
  }

  private async initializeBucket(): Promise<void> {
    try {
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      
      if (listError) {
        throw new Error(`Failed to list storage buckets: ${listError.message}`);
      }

      const bucketExists = buckets?.some(b => b.name === this.bucket);
      
      if (!bucketExists) {
        throw new Error(
          `Storage bucket "${this.bucket}" not found. Please contact your administrator to ensure proper storage configuration.`
        );
      }

      // Verify bucket is accessible
      const { error: verifyError } = await supabase.storage.from(this.bucket).list('avatars/');
      if (verifyError) {
        throw new Error(`Failed to access storage bucket: ${verifyError.message}`);
      }

      this.bucketValidated = true;
    } catch (error) {
      console.error("Storage initialization failed:", error);
      this.bucketValidated = false;
      throw new Error(
        `Storage initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
        'Please ensure proper storage configuration and permissions.'
      );
    }
  }

  private async ensureBucketInitialized(): Promise<void> {
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
    
    if (!this.bucketValidated) {
      this.initializationPromise = this.initializeBucket();
      await this.initializationPromise;
    }
  }

  private async compressImage(
    file: File,
    options: ImageUploadOptions
  ): Promise<File> {
    try {
      const compressedFile = await imageCompression(file, {
        maxSizeMB: options.maxSizeMB || 1,
        maxWidthOrHeight: Math.max(
          options.maxWidth || 1920,
          options.maxHeight || 1920
        ),
        useWebWorker: true,
        fileType: file.type as "image/jpeg" | "image/png",
        initialQuality: options.quality || 0.8,
      });

      return new File([compressedFile], file.name, {
        type: compressedFile.type,
      });
    } catch (error) {
      console.error("Error compressing image:", error);
      return file;
    }
  }

  private async getImageDimensions(file: File): Promise<{
    width: number;
    height: number;
  }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({
          width: img.width,
          height: img.height,
        });
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  async uploadImage(
    file: File,
    path: string,
    options: ImageUploadOptions = {}
  ): Promise<ImageUploadResult> {
    try {
      // Ensure bucket is initialized
      await this.ensureBucketInitialized();

      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Invalid file type. Only images are allowed.');
      }

      // Validate file size
      const maxSize = (options.maxSizeMB || 5) * 1024 * 1024;
      if (file.size > maxSize) {
        throw new Error(`File size exceeds ${options.maxSizeMB || 5}MB limit.`);
      }

      // Validate path format
      const pathParts = path.split('/');
      if (pathParts[0] !== 'avatars' || !pathParts[1]) {
        throw new Error('Invalid upload path. Must be in format: avatars/[user_id]/[filename]');
      }

      // Compress and optimize image
      const compressedFile = await this.compressImage(file, options);

      // Upload with retry logic
      const maxRetries = 3;
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const { error: uploadError } = await supabase.storage
            .from(this.bucket)
            .upload(path, compressedFile, {
              cacheControl: "3600",
              upsert: true,
            });

          if (uploadError) {
            if (uploadError.message.includes('Permission denied')) {
              throw new Error(
                'Permission denied. Please ensure you have the correct permissions to upload files.'
              );
            }
            throw uploadError;
          }

          // Get public URL
          const {
            data: { publicUrl },
          } = supabase.storage.from(this.bucket).getPublicUrl(path);

          // Get image dimensions
          const dimensions = await this.getImageDimensions(compressedFile);

          return {
            url: publicUrl,
            width: dimensions.width,
            height: dimensions.height,
            size: compressedFile.size,
            format: compressedFile.type.split("/")[1],
          };
        } catch (error) {
          lastError = error as Error;
          if (attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
            continue;
          }
        }
      }

      throw lastError || new Error('Upload failed after multiple attempts');
    } catch (error) {
      console.error("Error uploading to Supabase:", error);
      throw new Error(
        `Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
        'Please try again or contact support if the issue persists.'
      );
    }
  }

  async deleteImage(url: string): Promise<void> {
    try {
      await this.ensureBucketInitialized();

      const path = new URL(url).pathname.split("/").pop();
      if (!path) throw new Error("Invalid URL");

      const { error } = await supabase.storage.from(this.bucket).remove([path]);

      if (error) throw error;
    } catch (error) {
      console.error("Error deleting from Supabase:", error);
      throw error instanceof Error 
        ? error 
        : new Error('Unknown error occurred during deletion');
    }
  }

  async getImageUrl(path: string): Promise<string> {
    await this.ensureBucketInitialized();
    const {
      data: { publicUrl },
    } = supabase.storage.from(this.bucket).getPublicUrl(path);
    return publicUrl;
  }
}
