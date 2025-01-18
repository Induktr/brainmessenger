export interface ImageUploadOptions {
  maxSizeMB?: number;
  allowedTypes?: string[];
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export interface ImageUploadResult {
  url: string;
  width?: number;
  height?: number;
  size: number;
  format: string;
}

export interface StorageProvider {
  uploadImage: (
    file: File,
    path: string,
    options?: ImageUploadOptions
  ) => Promise<ImageUploadResult>;
  deleteImage: (url: string) => Promise<void>;
  getImageUrl: (path: string) => Promise<string>;
}
