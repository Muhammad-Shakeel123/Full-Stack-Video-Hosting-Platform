import asyncHandler from "../utils/asyncHandler.js";
import { Comment } from "../models/comment.model.js";
import ApiError from "../utils/ApiErrors.js";
import ApiResponse from "../utils/ApiResponse.js";
import { Video } from "../models/video.model.js";
import mongoose from "mongoose";
import { Like } from "../models/like.model.js";

const getVideoComments = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const video = Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }
  const commentsAggregate = Comment.aggregate([
    {
      $match: {
        video: new mongoose.Types.ObjectId(videoId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "comment",
        as: "likes",
      },
    },
    {
      $addFields: {
        likesCount: { $size: "$likes" },
        owner: {
          $first: "$owner",
        },
        isliked: {
          $cond: {
            if: { $in: [req.user._id, "$likes.likedBy"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
    {
      $project: {
        content: 1,
        createdAt: 1,
        likesCount: 1,
        owner: {
          username: 1,
          fullName: 1,
          "avatar.url": 1,
        },
      },
    },
  ]);

  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
  };

  const comments = await Comment.aggregatePaginate(commentsAggregate, options);

  return res
    .status(200)
    .json(new ApiResponse(200, comments, "Comments Fetched Successfully"));
});

// add comment to a video
const addComment = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { content } = req.body;
  if (!content) {
    throw new ApiError(400, "Content is required");
  }

  const video = Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  const comment = Comment.create({
    content,
    owner: req.user._id,
    video: videoId,
  });

  if (!comment) {
    throw new ApiError(500, "Failed to add comment");
  }

  return res
    .status(200)
    .json(new ApiResponse(201, comment, "Comment Added Successfully"));
});

// update a comment
const updateComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;

  if (!content) {
    throw new ApiError(400, "Content is required");
  }

  // Ensure that comment is found
  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }

  // Ensure that the owner field exists and matches the user
  if (comment.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to update this comment");
  }

  const updatedComment = await Comment.findByIdAndUpdate(
    commentId,
    { content },
    { new: true }
  );

  if (!updatedComment) {
    throw new ApiError(500, "Failed to update comment");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updatedComment, "Comment Updated Successfully"));
});


const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  // Ensure the comment is fetched asynchronously
  const comment = await Comment.findById(commentId);

  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }

  // Ensure that the comment owner exists before trying to access the owner field
  if (!comment.owner) {
    throw new ApiError(404, "Owner not found in comment");
  }

  // Ensure the logged-in user is the owner of the comment
  if (comment.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to delete this comment");
  }

  // Delete the comment
  await Comment.findByIdAndDelete(commentId);

  // Delete likes associated with the comment
  await Like.deleteMany({
    comment: commentId,
    likedBy: req.user,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, { commentId }, "Comment Deleted Successfully"));
});


export { getVideoComments, addComment, updateComment, deleteComment };
