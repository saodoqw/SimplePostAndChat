import { type Request } from 'express';
import multer, { type FileFilterCallback } from 'multer';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4'];
const AVATAR_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const IMAGE_MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const VIDEO_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_IMAGE_FILES = 10;
const MAX_CHAT_IMAGE_VIDEO_FILES = 10;
const memoryStorage = multer.memoryStorage();
// Helper function to create file filter for multer
const createFileFilter = (
    allowedTypes: string[],
    errorMessage: string
) => {
    return (
        _req: Request,
        file: Express.Multer.File,
        cb: FileFilterCallback
    ): void => {
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
            return;
        }

        cb(new Error(errorMessage));
    };
};
// Multer upload instances for different file types
const avatarUpload = multer({
    storage: memoryStorage,
    fileFilter: createFileFilter(ALLOWED_IMAGE_TYPES, 'Only image files are allowed for avatar upload'),
    limits: { fileSize: AVATAR_MAX_FILE_SIZE },
});

const imageUpload = multer({
    storage: memoryStorage,
    fileFilter: createFileFilter(ALLOWED_IMAGE_TYPES, 'Only image files are allowed for image upload'),
    limits: { fileSize: IMAGE_MAX_FILE_SIZE },
});

const videoUpload = multer({
    storage: memoryStorage,
    fileFilter: createFileFilter(ALLOWED_VIDEO_TYPES, 'Only mp4 video files are allowed for video upload'),
    limits: { fileSize: VIDEO_MAX_FILE_SIZE },
});

const chatImageVideoUpload = multer({
    storage: memoryStorage,
    fileFilter: createFileFilter(
        [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES],
        'Only image or mp4 video files are allowed for chat media upload'
    ),
    limits: { fileSize: VIDEO_MAX_FILE_SIZE },
});
//avartar: single file with field name 'avatar'
//images: multiple files with field name 'images', max 10 files
//video: single file with field name 'video'
//chat media: multiple files with field names 'images' and 'videos', max 10 files each
export const uploadAvatarMiddleware = avatarUpload.single('avatar');
export const uploadImageMiddleware = imageUpload.array('images', MAX_IMAGE_FILES);
export const uploadVideoMiddleware = videoUpload.single('videos');
// For chat media, we allow both images and videos in the same endpoint, with separate field names
export const uploadChatImageVideoMiddleware = chatImageVideoUpload.fields([
    { name: 'images', maxCount: MAX_CHAT_IMAGE_VIDEO_FILES },
    { name: 'videos', maxCount: MAX_CHAT_IMAGE_VIDEO_FILES },
]);