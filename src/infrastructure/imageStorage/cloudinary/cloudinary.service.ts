import cloudinary from "./config/cloudinary.config.js";

export interface CloudinaryService {
  uploadImage(fileBuffer: Buffer, folder: string): Promise<{ url: string; publicId: string }>;
  uploadVideo(fileBuffer: Buffer, folder: string): Promise<{ url: string; publicId: string }>;
  uploadAvatar(fileBuffer: Buffer, userId: string): Promise<{ url: string; publicId: string }>;
  deleteImage(publicId: string): Promise<void>;
  deleteVideo(publicId: string): Promise<void>;
}

export class CloudinaryServiceImpl implements CloudinaryService {
   async uploadImage(fileBuffer: Buffer, folder: string) {
    if (!fileBuffer.length) {
      throw new Error("Image file is empty");
    }

    const result = await new Promise<{ secure_url: string; public_id: string }>(
      (resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: "image"
          },
          (error, uploadResult) => {
            if (error) {
              reject(error);
              return;
            }

            if (!uploadResult) {
              reject(new Error("Cloudinary image upload failed"));
              return;
            }

            resolve({
              secure_url: uploadResult.secure_url,
              public_id: uploadResult.public_id
            });
          }
        );

        uploadStream.end(fileBuffer);
      }
    );

    return {
      url: result.secure_url,
      publicId: result.public_id
    };
  }
  async uploadVideo(fileBuffer: Buffer, folder: string) {
    if (!fileBuffer.length) {
      throw new Error("Video file is empty");
    }

    const result = await new Promise<{ secure_url: string; public_id: string }>(
      (resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: "video"
          },
          (error, uploadResult) => {
            if (error) {
              reject(error);
              return;
            }

            if (!uploadResult) {
              reject(new Error("Cloudinary video upload failed"));
              return;
            }

            resolve({
              secure_url: uploadResult.secure_url,
              public_id: uploadResult.public_id
            });
          }
        );

        uploadStream.end(fileBuffer);
      }
    );

    return {
      url: result.secure_url,
      publicId: result.public_id
    };
  }
  async uploadAvatar(fileBuffer: Buffer, userId: string) {
    if (!fileBuffer.length) {
      throw new Error("Avatar file is empty");
    }

    const result = await new Promise<{ secure_url: string; public_id: string }>(
      (resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            public_id: `avatars/${userId}`,
            overwrite: true,
            invalidate: true,
            resource_type: "image",
            transformation: [
              { width: 300, height: 300, crop: "fill" }
            ]
          },
          (error, uploadResult) => {
            if (error) {
              reject(error);
              return;
            }

            if (!uploadResult) {
              reject(new Error("Cloudinary avatar upload failed"));
              return;
            }

            resolve({
              secure_url: uploadResult.secure_url,
              public_id: uploadResult.public_id
            });
          }
        );

        uploadStream.end(fileBuffer);
      }
    );

    return {
      url: result.secure_url,
      publicId: result.public_id
    };
  }
  async deleteImage(publicId: string) {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: "image"
    });
  }
  async deleteVideo(publicId: string) {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: "video"
    });
  }
}

export const cloudinaryService: CloudinaryService = new CloudinaryServiceImpl();