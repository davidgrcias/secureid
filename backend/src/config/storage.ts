import fs from "node:fs";
import path from "node:path";
import { env } from "./env";

export const uploadDirectoryPath = path.resolve(process.cwd(), env.UPLOAD_DIR);

export function ensureUploadDirectory(): void {
  if (!fs.existsSync(uploadDirectoryPath)) {
    fs.mkdirSync(uploadDirectoryPath, { recursive: true });
  }
}
