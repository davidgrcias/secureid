import path from "node:path";
import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.middleware";
import { ApiError } from "../middleware/error.middleware";
import { uploadDocument } from "../middleware/upload.middleware";
import {
  archiveUserDocument,
  createDocumentRecord,
  getUserDocumentById,
  listUserDocuments
} from "../services/document.service";

const router = Router();

const uploadBodySchema = z.object({
  title: z.string().min(2).max(255).optional(),
  description: z.string().max(2000).optional()
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  status: z.string().optional()
});

function parseBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(400, "Validasi payload gagal.", parsed.error.flatten().fieldErrors);
  }

  return parsed.data;
}

function parseQuery<T>(schema: z.ZodSchema<T>, queryData: unknown): T {
  const parsed = schema.safeParse(queryData);
  if (!parsed.success) {
    throw new ApiError(400, "Validasi query gagal.", parsed.error.flatten().fieldErrors);
  }

  return parsed.data;
}

router.post(
  "/upload",
  authMiddleware,
  uploadDocument.single("file"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth) {
        throw new ApiError(401, "Tidak terautentikasi.");
      }

      if (!req.file) {
        throw new ApiError(400, "File dokumen wajib diunggah.");
      }

      const body = parseBody(uploadBodySchema, req.body);
      const document = await createDocumentRecord({
        uploaderId: req.auth.userId,
        title: body.title,
        description: body.description,
        file: req.file
      });

      res.status(201).json({
        message: "Dokumen berhasil diunggah.",
        data: document
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get("/", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      throw new ApiError(401, "Tidak terautentikasi.");
    }

    const queryParams = parseQuery(listQuerySchema, req.query);
    const result = await listUserDocuments({
      userId: req.auth.userId,
      page: queryParams.page ?? 1,
      limit: queryParams.limit ?? 10,
      status: queryParams.status
    });

    res.status(200).json({
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      throw new ApiError(401, "Tidak terautentikasi.");
    }

    const document = await getUserDocumentById(req.auth.userId, req.params.id);
    res.status(200).json({ data: document });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/download", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      throw new ApiError(401, "Tidak terautentikasi.");
    }

    const document = await getUserDocumentById(req.auth.userId, req.params.id);
    const absolutePath = path.resolve(process.cwd(), document.filePath);

    res.download(absolutePath, document.originalFilename);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      throw new ApiError(401, "Tidak terautentikasi.");
    }

    await archiveUserDocument(req.auth.userId, req.params.id);
    res.status(200).json({ message: "Dokumen diarsipkan." });
  } catch (error) {
    next(error);
  }
});

export default router;
