import express from 'express';
import multer from 'multer';
import { auth } from '../middlewares/auth.js';
import { generateArticle, generateBlogTitle, generateImage, removeImageBackground, removeImageObject } from '../controllers/aiController.js';

// Configure storage for uploaded files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Specify the directory where files will be stored
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname); // Define the filename
  }
});

const upload = multer({ storage: storage });

const aiRouter = express.Router();

aiRouter.post('/generate-article', auth, generateArticle);
aiRouter.post('/generate-blog-title', auth, generateBlogTitle);
aiRouter.post('/generate-image', auth, generateImage);
aiRouter.post('/remove-image-bg', auth, upload.single('image'), removeImageBackground);
aiRouter.post('/remove-image-object', auth, upload.single('image'), removeImageObject);
aiRouter.post('/review-resume', auth, upload.single('resume'), reviewResume);

export default aiRouter;