import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import ApiError from "../utils/ApiErrors.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import uploadOnCloudinary from "../utils/cloudinary.js";
import deleteOnCloudnary from "../utils/deleteFromCloudinary.js";
import { Like } from "../models/like.model.js"
import {Comment} from "../models/comment.model.js"

const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
  const pippline = [];
  if (query) {
    pippline.push({
      $search: {
        index: "search-videos",
        text: {
          query: query,
          path: ["title", "description"],
        },
      },
    });
  }
  if (userId) {
    if (!isValidObjectId(userId)) {
      throw new ApiError(400, "Invalid user id");
    }
  }
  pippline.push({
    $match: {
      owner: new mongoose.Types.ObjectId(userId),
    },
  });
  pippline.push({
    $match: {
      isPublished: true,
    },
  });
  if (sortBy && sortType) {
    pippline.push({
      $sort: {
        [sortBy]: sortType === "asc" ? 1 : -1,
      },
    });
  } else {
    pippline.push({
      $sort: {
        createdAt: -1,
      },
    });
  }
  pippline.push(
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "ownerInfo",
        pipeline: [
          {
            $project: {
              username: 1,
              "avatar.url": 1,
            },
          },
        ],
      },
    },
    {
      $unwind: "$ownerInfo",
    }
  );
  const videoAggregate = await Video.aggregate(pippline);
  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
  };
  const video = await Video.aggregatePaginate(videoAggregate, options);
  return res
    .status(200)
    .json(new ApiResponse(video, 200, "Videos fetched successfully"));
});

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  if ([title, description].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "All fields are required");
  }
  const videoFileLocalPath = req.files?.videoFile[0].path;
  const thumbnailLoclaPath = req.files?.thumbnail[0].path;
  if (!videoFileLocalPath) {
    throw new ApiError(400, "Video file is required");
  }
  if (!thumbnailLoclaPath) {
    throw new ApiError(400, "Thumbnail is required");
  }
  const videoFile = await uploadOnCloudinary(videoFileLocalPath);
  const thumbnail = await uploadOnCloudinary(thumbnailLoclaPath);
  if (!videoFile) {
    throw new ApiError(500, "Failed to upload video to cloudinary");
  }
  if (!thumbnail) {
    throw new ApiError(500, "Failed to upload thumbnail to cloudinary");
  }
  const video = await Video.create({
    title,
    description,
    duration: videoFile.duration,
    videoFile: {
      url: videoFile.url,
      public_id: videoFile.public_id,
    },
    thumbnail: {
      url: thumbnail.url,
      public_id: thumbnail.public_id,
    },
    owner: req.user?._id,
    isPublished: false,
  });
  const videoUploaded = await Video.findById(video._id);
  if (!videoUploaded) {
    throw new ApiError(500, "Failed to create video");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video uploaded successfully"));
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: get video by id
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }

  const video = await Video.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(videoId),
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "likes",
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $lookup: {
              from: "subscriptions",
              localField: "_id",
              foreignField: "subscriber",
              as: "subscribers",
            },
          },
          {
            $addFields: {
              subscriberCount: {
                $size: "$subscribers",
              },
              isSubscribed: {
                $cond: {
                  if: { in: ["$subscribers.subscriber", req.user._id] },
                  then: true,
                  else: false,
                },
              },
            },
          },
          {
            $project: {
              username: 1,
              subscriberCount: 1,
              isSubscribed: 1,
              "avatar.url": 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        likesCount: {
          $size: "$likes",
        },
        owner: {
          $first: "$owner",
        },
        isLiked: {
          $cond: {
            if: { $in: [req.user?._id, "$likes.likedBy"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        "videoFile.url": 1,
        title: 1,
        description: 1,
        views: 1,
        createdAt: 1,
        duration: 1,
        comments: 1,
        owner: 1,
        likesCount: 1,
        isLiked: 1,
      },
    },
  ]);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }
  await Video.findByIdAndUpdate(videoId, {
    $inc: {
      views: 1,
    },
  });
  await User.findByIdAndUpdate(req.user?._id, {
    $addToSet: {
      watchHistory: videoId,
    },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, video[0], "video details fetched successfully"));
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: update video details like title, description, thumbnail
  const { title, description } = req.body;
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }
  if (!title || !description) {
    throw new ApiError(400, "Title and description are required");
  }
  const video = await Video.findById(videoId);

  if (video?.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(403, "You are not the owner of this video");
  }
  const thumbnailToDelete = video.thumbnail.public_id;
  const thumbnailLoclaPath = req.file.path;
  if (!thumbnailLoclaPath) {
    throw new ApiError(400, "Thumbnail is required");
  }
  const thumbnail = await uploadOnCloudinary(thumbnailLoclaPath);
  if (!thumbnail) {
    throw new ApiError(400, "Failed to upload thumbnail");
  }
  const updateVideo = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        title,
        description,
        thumbnail: {
          public_id: thumbnail.public_id,
          url: thumbnail.url,
        },
      },
    },
    {
      new: true,
    }
  );
  if (!updateVideo) {
    throw new ApiError(404, "Failed to update video");
  }
  if (updateVideo) {
    await deleteOnCloudnary(thumbnailToDelete);
  }
  return res
    .status(200)
    .json(new ApiResponse(200, updateVideo, "Video updated successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }
  if (video?.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(403, "You are not the owner of this video to delete");
  }
  const deleteVideo = await Video.findByIdAndDelete(video?._id);
  if (!deleteVideo) {
    throw new ApiError(404, "Failed to delete video");
  }
  await deleteOnCloudnary(video.thumbnail.public_id);
  await deleteOnCloudnary(video.videoFile.public_id, "video");
  await Like.deleteMany({
    video: videoId,
  });
  await Comment.deleteMany({
    video: videoId,
  });
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Video deleted successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }
  if (video?.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(
      403,
      "You can't toogle publish status as you are not the owner"
    );
  }
  const toggledVideoPublish = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        isPublished: !video.isPublished,
      },
    },
    {
      new: true,
    }
  );
  if (!toggledVideoPublish) {
    throw new ApiError(404, "Failed to toggle publish status");
  }
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { isPublished: toggledVideoPublish.isPublished },
        "Publish status toggled successfully"
      )
    );
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
