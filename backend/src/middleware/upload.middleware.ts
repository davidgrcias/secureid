import { randomUUID } from "node:crypto";
import path from "node:path";
import multer, { type FileFilterCallback } from "multer";
import { ensureUploadDirectory, uploadDirectoryPath } from "../config/storage";

const ALLOWED_EXTENSIONS = new Set([".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"]);
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png"
]);
const ALLOWED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png"]);

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    ensureUploadDirectory();
    cb(null, uploadDirectoryPath);
  },
  filename(_req, file, cb) {
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${randomUUID()}${extension}`);
  }
});

function fileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void {
  const extension = path.extname(file.originalname).toLowerCase();
  const hasAllowedExtension = ALLOWED_EXTENSIONS.has(extension);
  const hasAllowedMimeType = ALLOWED_MIME_TYPES.has(file.mimetype);

  if (!hasAllowedExtension || !hasAllowedMimeType) {
    cb(new Error("Format file tidak didukung. Gunakan PDF/DOC/JPG/PNG."));
    return;
  }

  cb(null, true);
}

export const uploadDocument = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024
  }
});

function imageFileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void {
  const extension = path.extname(file.originalname).toLowerCase();
  const hasAllowedExtension = ALLOWED_IMAGE_EXTENSIONS.has(extension);
  const hasAllowedMimeType = ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype);

  if (!hasAllowedExtension || !hasAllowedMimeType) {
    cb(new Error("Format file tidak didukung. Gunakan JPG/PNG."));
    return;
  }

  cb(null, true);
}

export const uploadImage = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});
