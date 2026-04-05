export type UploadResult = { url: string; publicId: string };

export interface ImageStorageService {
    uploadMany(fileBuffers: Buffer[], folder: string): Promise<UploadResult[]>;
    uploadImage(fileBuffer: Buffer, folder: string): Promise<UploadResult>;
    uploadVideo(fileBuffer: Buffer, folder: string): Promise<UploadResult>;
    uploadAvatar(fileBuffer: Buffer, userId: string): Promise<UploadResult>;
    deleteImage(publicId: string): Promise<void>;
    deleteVideo(publicId: string): Promise<void>;
}
