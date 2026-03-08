import cloudinary from "./config/cloudinary.config.js";

class CloudinaryService {
   async uploadImage(filePath: string, folder: string) {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: folder,
      resource_type: "image"
    });

    return {
      url: result.secure_url,
      publicId: result.public_id
    };
  }
  async uploadVideo(filePath: string, folder: string) {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: folder,
      resource_type: "video"
    });

    return {
      url: result.secure_url,
      publicId: result.public_id
    };
  }
  async uploadAvatar(filePath: string, userId: string) {
    const result = await cloudinary.uploader.upload(filePath, {
      public_id: `avatars/${userId}`,
      overwrite: true,
      invalidate: true,
      resource_type: "image",
      transformation: [
        { width: 300, height: 300, crop: "fill"}
      ]
    });

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

export default new CloudinaryService();