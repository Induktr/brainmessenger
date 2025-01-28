import { StorageProvider, ImageUploadOptions, ImageUploadResult } from "../types";

export class CloudinaryStorageProvider implements StorageProvider {
  private cloudName: string;
  private uploadPreset: string;

  constructor(cloudName: string, uploadPreset: string) {
    this.cloudName = cloudName;
    this.uploadPreset = uploadPreset;
  }

  async uploadImage(
    file: File,
    // path parameter required by StorageProvider interface but not used by Cloudinary
    _path: string,
    options: ImageUploadOptions = {}
  ): Promise<ImageUploadResult> {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", this.uploadPreset);
      if (options.maxWidth) formData.append("width", options.maxWidth.toString());
      if (options.maxHeight)
        formData.append("height", options.maxHeight.toString());
      if (options.quality)
        formData.append("quality", options.quality.toString());

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) throw new Error("Upload failed");

      const data = await response.json();

      return {
        url: data.secure_url,
        width: data.width,
        height: data.height,
        size: data.bytes,
        format: data.format,
      };
    } catch (error) {
      console.error("Error uploading to Cloudinary:", error);
      throw error;
    }
  }

  async deleteImage(url: string): Promise<void> {
    try {
      const publicId = url.split("/").pop()?.split(".")[0];
      if (!publicId) throw new Error("Invalid URL");

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${this.cloudName}/image/destroy`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            public_id: publicId,
            upload_preset: this.uploadPreset,
          }),
        }
      );

      if (!response.ok) throw new Error("Delete failed");
    } catch (error) {
      console.error("Error deleting from Cloudinary:", error);
      throw error;
    }
  }

  async getImageUrl(path: string): Promise<string> {
    return `https://res.cloudinary.com/${this.cloudName}/image/upload/${path}`;
  }
}
