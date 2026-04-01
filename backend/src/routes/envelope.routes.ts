import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.middleware";
import { ApiError } from "../middleware/error.middleware";
import {
  createEnvelope,
  getEnvelopeAuditLogs,
  getEnvelopeDetail,
  listEnvelopes,
  remindEnvelope,
  replaceEnvelopeFields,
  sendEnvelope,
  updateEnvelopeDraft,
  voidEnvelope
} from "../services/envelope.service";

const router = Router();

const recipientSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  role: z.enum(["signer", "viewer", "approver"]).optional(),
  signingOrder: z.number().int().positive().optional()
});

const createEnvelopeSchema = z.object({
  documentId: z.string().uuid(),
  title: z.string().min(2).max(255),
  message: z.string().max(2000).optional(),
  sequentialSigning: z.boolean().optional(),
  autoReminder: z.boolean().optional(),
  expiresAt: z.string().datetime().optional(),
  recipients: z.array(recipientSchema).min(1)
});

const updateEnvelopeSchema = z.object({
  title: z.string().min(2).max(255).optional(),
  message: z.string().max(2000).optional(),
  sequentialSigning: z.boolean().optional(),
  autoReminder: z.boolean().optional(),
  expiresAt: z.string().datetime().optional()
});

const fieldSchema = z.object({
  recipientId: z.string().uuid().optional(),
  fieldType: z.enum(["signature", "initial", "date", "text", "checkbox"]),
  pageNumber: z.number().int().positive(),
  positionX: z.number().min(0),
  positionY: z.number().min(0),
  width: z.number().positive(),
  height: z.number().positive(),
  required: z.boolean().optional(),
  value: z.string().optional()
});

const replaceFieldsSchema = z.object({
  fields: z.array(fieldSchema)
});

function parseBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(400, "Validasi payload gagal.", parsed.error.flatten().fieldErrors);
  }

  return parsed.data;
}

router.post("/", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      throw new ApiError(401, "Tidak terautentikasi.");
    }

    const payload = parseBody(createEnvelopeSchema, req.body);
    const result = await createEnvelope({
      senderId: req.auth.userId,
      ...payload
    });

    res.status(201).json({
      message: "Envelope berhasil dibuat.",
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.get("/", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      throw new ApiError(401, "Tidak terautentikasi.");
    }

    const items = await listEnvelopes(req.auth.userId);
    res.status(200).json({ data: items });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      throw new ApiError(401, "Tidak terautentikasi.");
    }

    const detail = await getEnvelopeDetail(req.auth.userId, req.params.id);
    res.status(200).json({ data: detail });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      throw new ApiError(401, "Tidak terautentikasi.");
    }

    const payload = parseBody(updateEnvelopeSchema, req.body);
    const updated = await updateEnvelopeDraft(req.auth.userId, req.params.id, payload);

    res.status(200).json({
      message: "Envelope berhasil diperbarui.",
      data: updated
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/fields", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      throw new ApiError(401, "Tidak terautentikasi.");
    }

    const payload = parseBody(replaceFieldsSchema, req.body);
    const fields = await replaceEnvelopeFields(req.auth.userId, req.params.id, payload.fields);

    res.status(200).json({
      message: "Field envelope berhasil disimpan.",
      data: fields
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/send", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      throw new ApiError(401, "Tidak terautentikasi.");
    }

    const envelope = await sendEnvelope(req.auth.userId, req.params.id);
    res.status(200).json({
      message: "Envelope berhasil dikirim.",
      data: envelope
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/void", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      throw new ApiError(401, "Tidak terautentikasi.");
    }

    const envelope = await voidEnvelope(req.auth.userId, req.params.id);
    res.status(200).json({
      message: "Envelope dibatalkan.",
      data: envelope
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/remind", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      throw new ApiError(401, "Tidak terautentikasi.");
    }

    await remindEnvelope(req.auth.userId, req.params.id);
    res.status(200).json({
      message: "Pengingat berhasil diproses."
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/audit", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      throw new ApiError(401, "Tidak terautentikasi.");
    }

    const audit = await getEnvelopeAuditLogs(req.auth.userId, req.params.id);
    res.status(200).json({ data: audit });
  } catch (error) {
    next(error);
  }
});

export default router;
