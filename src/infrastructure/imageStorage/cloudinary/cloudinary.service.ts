import cloudinary from "./config/cloudinary.config.js";
import { type UploadApiOptions, type UploadApiResponse } from "cloudinary";
import {
  type ImageStorageService,
  type UploadResult,
} from "../../../application/ports/image-storage.service.js";

 class CloudinaryServiceImpl implements ImageStorageService {
  async uploadMany(fileBuffers: Buffer[], folder: string): Promise<UploadResult[]> {
    if (!fileBuffers.length) return [];
    return Promise.all(fileBuffers.map((buffer) => this.uploadImage(buffer, folder)));
  }

  private upload(
    fileBuffer: Buffer,
    options: UploadApiOptions,
    emptyMessage: string,
    failMessage: string
  ): Promise<UploadResult> {
    this.ensureBufferNotEmpty(fileBuffer, emptyMessage);
    return this.uploadStream(fileBuffer, options, failMessage);
  }

  private ensureBufferNotEmpty(fileBuffer: Buffer, emptyMessage: string): void {
    if (!fileBuffer.length) {
      throw new Error(emptyMessage);
    }
  }

  private uploadStream(
    fileBuffer: Buffer,
    options: UploadApiOptions,
    failMessage: string
  ): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(options, (error, uploadResult) => {
        if (error) {
          reject(error);
          return;
        }

        try {
          resolve(this.toUploadResult(uploadResult, failMessage));
        } catch (conversionError) {
          reject(conversionError);
        }
      });

      stream.end(fileBuffer);
    });
  }

  private toUploadResult(
    uploadResult: UploadApiResponse | undefined,
    failMessage: string
  ): UploadResult {
    if (!uploadResult?.secure_url || !uploadResult?.public_id) {
      throw new Error(failMessage);
    }

    return {
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id
    };
  }

  async uploadImage(fileBuffer: Buffer, folder: string): Promise<UploadResult> {
    return this.upload(
      fileBuffer,
      { folder, resource_type: "image" },
      "Image file is empty",
      "Cloudinary image upload failed"
    );
  }

  async uploadVideo(fileBuffer: Buffer, folder: string): Promise<UploadResult> {
    return this.upload(
      fileBuffer,
      { folder, resource_type: "video" },
      "Video file is empty",
      "Cloudinary video upload failed"
    );
  }

  async uploadAvatar(fileBuffer: Buffer, userId: string): Promise<UploadResult> {
    return this.upload(
      fileBuffer,
      {
        public_id: `avatars/${userId}`,
        overwrite: true,
        invalidate: true,
        resource_type: "image",
        transformation: [{ width: 300, height: 300, crop: "fill" }]
      },
      "Avatar file is empty",
      "Cloudinary avatar upload failed"
    );
  }

  async deleteImage(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  }

  async deleteVideo(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId, { resource_type: "video" });
  }
}

export const cloudinaryService: ImageStorageService = new CloudinaryServiceImpl();