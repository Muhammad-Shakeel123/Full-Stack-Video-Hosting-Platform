import { Router } from "express";
import { addComment } from "../controllers/comment.controller.js";
import { deleteComment } from "../controllers/comment.controller.js";
import { getVideoComments } from "../controllers/comment.controller.js";
import { updateComment } from "../controllers/comment.controller.js";
import  verifyJWT  from "../middlewares/auth.middleware.js";

const router = Router();

router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file

router.route("/:videoId").get(getVideoComments).post(addComment);
router.route("/c/:commentId").delete(deleteComment).patch(updateComment);

export default router;
