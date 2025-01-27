import { v2 as cloudinary } from "cloudinary";

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Function to delete a file from Cloudinary
const deleteOnCloudnary = async (publicId) => {
  try {
    if (!publicId) {
      throw new Error("No public_id provided");
    }

    const result = await cloudinary.uploader.destroy(publicId);

    // Check result status and return accordingly
    if (result.result === "ok") {
      console.log(`Successfully deleted ${publicId} from Cloudinary.`);
      return true;
    } else {
      console.log(`Failed to delete ${publicId} from Cloudinary.`);
      return false;
    }
  } catch (error) {
    console.error("Error deleting file from Cloudinary:", error);
    return false;
  }
};

export default deleteOnCloudnary;
