"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

type SignaturePayload = {
  type: "draw" | "type" | "upload";
  value: string;
  fontFamily?: string;
};

type SignatureModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: SignaturePayload) => void;
};

const typeFonts = ["'Brush Script MT', cursive", "'Georgia', serif", "'Trebuchet MS', sans-serif"];

export default function SignatureModal({ open, onClose, onSubmit }: SignatureModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  const [tab, setTab] = useState<"draw" | "type" | "upload">("draw");
  const [typedSignature, setTypedSignature] = useState("");
  const [typedFont, setTypedFont] = useState(typeFonts[0]);
  const [uploadDataUrl, setUploadDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#003d9b";
    context.lineWidth = 2;
    context.lineCap = "round";
  }, [open]);

  function getCanvasCoordinates(event: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) {
      return { x: 0, y: 0 };
    }

    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height
    };
  }

  function handleDrawStart(event: React.MouseEvent<HTMLCanvasElement>): void {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const { x, y } = getCanvasCoordinates(event);
    isDrawingRef.current = true;
    context.beginPath();
    context.moveTo(x, y);
  }

  function handleDrawMove(event: React.MouseEvent<HTMLCanvasElement>): void {
    if (!isDrawingRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const { x, y } = getCanvasCoordinates(event);
    context.lineTo(x, y);
    context.stroke();
  }

  function handleDrawEnd(): void {
    isDrawingRef.current = false;
  }

  function clearCanvas(): void {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  function handleUploadFile(event: React.ChangeEvent<HTMLInputElement>): void {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      setUploadDataUrl(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setUploadDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(selectedFile);
  }

  function handleSubmit(): void {
    if (tab === "draw") {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      onSubmit({
        type: "draw",
        value: canvas.toDataURL("image/png")
      });
      return;
    }

    if (tab === "type") {
      if (!typedSignature.trim()) {
        return;
      }

      onSubmit({
        type: "type",
        value: typedSignature.trim(),
        fontFamily: typedFont
      });
      return;
    }

    if (tab === "upload" && uploadDataUrl) {
      onSubmit({
        type: "upload",
        value: uploadDataUrl
      });
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-surface-container-lowest p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-on-surface">Buat Signature</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface-container text-on-surface-variant"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          {(["draw", "type", "upload"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setTab(option)}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                tab === option ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface"
              }`}
            >
              {option === "draw" ? "Draw" : option === "type" ? "Type" : "Upload"}
            </button>
          ))}
        </div>

        {tab === "draw" ? (
          <div className="mt-4 space-y-3">
            <canvas
              ref={canvasRef}
              width={700}
              height={240}
              className="w-full rounded-xl border border-outline-variant/30 bg-white"
              onMouseDown={handleDrawStart}
              onMouseMove={handleDrawMove}
              onMouseUp={handleDrawEnd}
              onMouseLeave={handleDrawEnd}
            />
            <button
              type="button"
              onClick={clearCanvas}
              className="rounded-lg bg-surface-container px-3 py-2 text-xs font-semibold text-on-surface"
            >
              Bersihkan Canvas
            </button>
          </div>
        ) : null}

        {tab === "type" ? (
          <div className="mt-4 space-y-3">
            <input
              value={typedSignature}
              onChange={(event) => setTypedSignature(event.target.value)}
              placeholder="Ketik nama untuk signature"
              className="w-full rounded-xl bg-surface-container px-4 py-3 text-sm text-on-surface outline-none"
            />
            <select
              value={typedFont}
              onChange={(event) => setTypedFont(event.target.value)}
              className="w-full rounded-xl bg-surface-container px-4 py-3 text-sm text-on-surface outline-none"
            >
              {typeFonts.map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </select>
            <div className="rounded-xl bg-white px-4 py-5 text-3xl text-[#111c2a]" style={{ fontFamily: typedFont }}>
              {typedSignature || "Preview signature"}
            </div>
          </div>
        ) : null}

        {tab === "upload" ? (
          <div className="mt-4 space-y-3">
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={handleUploadFile}
              className="w-full rounded-xl bg-surface-container px-4 py-3 text-sm text-on-surface"
            />
            <div className="rounded-xl bg-white p-4">
              {uploadDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={uploadDataUrl} alt="Signature upload preview" className="max-h-32" />
              ) : (
                <p className="text-sm text-on-surface-variant">Belum ada file diunggah.</p>
              )}
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-surface-container px-5 py-3 text-sm font-semibold text-on-surface"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-xl bg-gradient-to-r from-primary to-primary-container px-5 py-3 text-sm font-bold text-on-primary"
          >
            Gunakan Signature
          </button>
        </div>
      </div>
    </div>
  );
}
