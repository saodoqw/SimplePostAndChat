import "dotenv/config";
import path from "node:path";
import cloudinaryService from "../cloudinary/cloudinary.service.js";

async function main() {
//   const imagePath = path.resolve("src/infrastructure/imageStorage/test/test.jpg");

//   const uploaded = await cloudinaryService.uploadImage(
//     imagePath,
//     "simple-post-and-chat/test"
//   );
//   console.log("Uploaded:", uploaded);

//   await cloudinaryService.deleteImage(uploaded.publicId);
//   console.log("Deleted image OK");
testVideo();
}
const testVideo = async () => {
  const videoPath = path.resolve("src/infrastructure/imageStorage/test/[Vietsub][AVM] Koe no katachi - Có một người tôi yêu.mp4");

  const uploaded = await cloudinaryService.uploadVideo(
    videoPath,
    "simple-post-and-chat/test"
  );
  console.log("Uploaded:", uploaded);

  await cloudinaryService.deleteVideo(uploaded.publicId);
  console.log("Deleted video OK");
};

main().catch((err) => {
  console.error("Cloudinary test failed:", err);
  process.exit(1);
});