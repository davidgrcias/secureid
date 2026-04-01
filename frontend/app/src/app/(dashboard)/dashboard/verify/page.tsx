"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  Circle,
  Crosshair,
  Eye,
  Sun,
  UploadCloud,
  X
} from "lucide-react";
import {
  getVerificationOverview,
  submitLivenessVerification,
  uploadVerificationFile,
  type VerificationOverview
} from "@/lib/verification";

type LivenessStepId = "blink" | "mouth_open" | "smile";

type LivenessStep = {
  id: LivenessStepId;
  label: string;
  hint: string;
};

type LivenessStepState = Record<LivenessStepId, boolean>;

type BlendshapeCategory = {
  categoryName: string;
  score: number;
};

type FaceLandmarkerResult = {
  faceLandmarks?: unknown[];
  faceBlendshapes?: Array<{
    categories?: BlendshapeCategory[];
  }>;
};

type FaceLandmarkerLike = {
  detectForVideo: (video: HTMLVideoElement, timestampMs: number) => FaceLandmarkerResult;
  close?: () => void;
};

const livenessSteps: LivenessStep[] = [
  {
    id: "blink",
    label: "Berkedip sekali",
    hint: "Kedipkan kedua mata sekali dengan jelas."
  },
  {
    id: "mouth_open",
    label: "Buka mulut",
    hint: "Buka mulut sebentar lalu kembali normal."
  },
  {
    id: "smile",
    label: "Senyum natural",
    hint: "Berikan senyum natural ke arah kamera."
  }
];

const initialLivenessState: LivenessStepState = {
  blink: false,
  mouth_open: false,
  smile: false
};

const MP_WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm";
const MP_FACE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

function stopMediaStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

function scoreOf(categories: BlendshapeCategory[], ...names: string[]): number {
  return names.reduce((highest, name) => {
    const value = categories.find((item) => item.categoryName === name)?.score ?? 0;
    return Math.max(highest, value);
  }, 0);
}

async function blobFromVideo(video: HTMLVideoElement): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas context tidak tersedia.");
  }

  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Gagal mengambil frame kamera."));
        return;
      }

      resolve(blob);
    }, "image/jpeg", 0.95);
  });
}

export default function VerifyPage() {
  const [ktpFile, setKtpFile] = useState<File | null>(null);
  const [ktpBackFile, setKtpBackFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);

  const [isSelfieCameraOpen, setIsSelfieCameraOpen] = useState(false);
  const [isOpeningSelfieCamera, setIsOpeningSelfieCamera] = useState(false);

  const [isLivenessOpen, setIsLivenessOpen] = useState(false);
  const [isPreparingLiveness, setIsPreparingLiveness] = useState(false);
  const [livenessStepIndex, setLivenessStepIndex] = useState(0);
  const [livenessStepState, setLivenessStepState] = useState<LivenessStepState>(initialLivenessState);
  const [livenessHint, setLivenessHint] = useState<string>(livenessSteps[0].hint);
  const [isLivenessSuccess, setIsLivenessSuccess] = useState(false);

  const [overview, setOverview] = useState<VerificationOverview | null>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [isUploadingKtpFront, setIsUploadingKtpFront] = useState(false);
  const [isUploadingKtpBack, setIsUploadingKtpBack] = useState(false);
  const [isUploadingSelfie, setIsUploadingSelfie] = useState(false);
  const [isSubmittingLiveness, setIsSubmittingLiveness] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const selfieVideoRef = useRef<HTMLVideoElement | null>(null);
  const selfieStreamRef = useRef<MediaStream | null>(null);

  const livenessVideoRef = useRef<HTMLVideoElement | null>(null);
  const livenessStreamRef = useRef<MediaStream | null>(null);
  const livenessAnimationFrameRef = useRef<number | null>(null);
  const livenessStepStateRef = useRef<LivenessStepState>(initialLivenessState);
  const isLivenessOpenRef = useRef(false);
  const livenessHintRef = useRef(livenessSteps[0].hint);
  const faceLandmarkerRef = useRef<FaceLandmarkerLike | null>(null);

  const latestKtp = overview?.latestByType.ktp_photo;
  const latestSelfie = overview?.latestByType.selfie;
  const latestLiveness = overview?.latestByType.liveness;

  const isKtpReady = latestKtp?.status === "verified";
  const isSelfieReady = latestSelfie?.status === "verified";
  const isLivenessVerified = latestLiveness?.status === "verified";

  const currentInstruction = livenessSteps[livenessStepIndex]?.label ?? livenessSteps[0].label;

  const progressPercent = useMemo(() => {
    const completed = livenessSteps.filter((step) => livenessStepState[step.id]).length;
    return Math.round((completed / livenessSteps.length) * 100);
  }, [livenessStepState]);

  async function refreshOverview(): Promise<void> {
    const data = await getVerificationOverview();
    setOverview(data);
    if (data.latestByType.liveness?.status === "verified") {
      setIsLivenessSuccess(true);
      setLivenessStepState({ ...initialLivenessState, blink: true, mouth_open: true, smile: true });
      setLivenessStepIndex(livenessSteps.length - 1);
      updateLivenessHint("Liveness sudah terverifikasi oleh sistem.");
    }
  }

  function updateLivenessHint(nextHint: string): void {
    if (livenessHintRef.current === nextHint) {
      return;
    }

    livenessHintRef.current = nextHint;
    setLivenessHint(nextHint);
  }

  function resetLivenessState(): void {
    const nextState = { ...initialLivenessState };
    livenessStepStateRef.current = nextState;
    setLivenessStepState(nextState);
    setLivenessStepIndex(0);
    updateLivenessHint(livenessSteps[0].hint);
    setIsLivenessSuccess(false);
  }

  function clearSelfieCamera(): void {
    if (selfieVideoRef.current) {
      selfieVideoRef.current.srcObject = null;
    }

    stopMediaStream(selfieStreamRef.current);
    selfieStreamRef.current = null;
  }

  function clearLivenessSession(): void {
    if (livenessAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(livenessAnimationFrameRef.current);
      livenessAnimationFrameRef.current = null;
    }

    isLivenessOpenRef.current = false;

    if (livenessVideoRef.current) {
      livenessVideoRef.current.srcObject = null;
    }

    stopMediaStream(livenessStreamRef.current);
    livenessStreamRef.current = null;
  }

  async function ensureFaceLandmarker(): Promise<FaceLandmarkerLike> {
    if (faceLandmarkerRef.current) {
      return faceLandmarkerRef.current;
    }

    const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const vision = await FilesetResolver.forVisionTasks(MP_WASM_URL);

    let landmarker: FaceLandmarkerLike;

    try {
      landmarker = (await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MP_FACE_MODEL_URL,
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true
      })) as FaceLandmarkerLike;
    } catch {
      landmarker = (await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MP_FACE_MODEL_URL
        },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true
      })) as FaceLandmarkerLike;
    }

    faceLandmarkerRef.current = landmarker;
    return landmarker;
  }

  function completeLivenessStep(stepId: LivenessStepId): void {
    setLivenessStepState((current) => {
      if (current[stepId]) {
        return current;
      }

      const nextState = {
        ...current,
        [stepId]: true
      };

      livenessStepStateRef.current = nextState;
      return nextState;
    });
  }

  function runLivenessDetectionLoop(): void {
    const video = livenessVideoRef.current;
    const detector = faceLandmarkerRef.current;

    if (!video || !detector) {
      return;
    }

    if (livenessAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(livenessAnimationFrameRef.current);
      livenessAnimationFrameRef.current = null;
    }

    const detect = (): void => {
      const activeVideo = livenessVideoRef.current;
      const activeDetector = faceLandmarkerRef.current;

      if (!activeVideo || !activeDetector || !isLivenessOpenRef.current) {
        return;
      }

      if (activeVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        const result = activeDetector.detectForVideo(activeVideo, performance.now());
        const hasFace = (result.faceLandmarks?.length ?? 0) > 0;

        if (!hasFace) {
          updateLivenessHint("Wajah belum terdeteksi. Pastikan wajah berada di tengah frame.");
        } else {
          const categories = result.faceBlendshapes?.[0]?.categories ?? [];
          const blinkScore = scoreOf(categories, "eyeBlinkLeft", "eyeBlinkRight");
          const mouthOpenScore = scoreOf(categories, "jawOpen");
          const smileScore = scoreOf(categories, "mouthSmileLeft", "mouthSmileRight");

          const nextStep = livenessSteps.find((step) => !livenessStepStateRef.current[step.id]);

          if (!nextStep) {
            setIsLivenessSuccess(true);
            updateLivenessHint("Semua tantangan liveness selesai. Simpan hasil verifikasi.");
          } else {
            setIsLivenessSuccess(false);
            updateLivenessHint(nextStep.hint);

            if (nextStep.id === "blink" && blinkScore >= 0.45) {
              completeLivenessStep("blink");
            }

            if (nextStep.id === "mouth_open" && mouthOpenScore >= 0.35) {
              completeLivenessStep("mouth_open");
            }

            if (nextStep.id === "smile" && smileScore >= 0.5) {
              completeLivenessStep("smile");
            }
          }
        }
      }

      livenessAnimationFrameRef.current = window.requestAnimationFrame(detect);
    };

    livenessAnimationFrameRef.current = window.requestAnimationFrame(detect);
  }

  async function openSelfieCamera(): Promise<void> {
    try {
      setErrorMessage(null);
      setSuccessMessage(null);
      setIsOpeningSelfieCamera(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      selfieStreamRef.current = stream;
      setIsSelfieCameraOpen(true);

      if (selfieVideoRef.current) {
        selfieVideoRef.current.srcObject = stream;
        await selfieVideoRef.current.play();
      }
    } catch {
      setErrorMessage("Kamera tidak dapat diakses. Pastikan izin kamera sudah diaktifkan.");
      clearSelfieCamera();
      setIsSelfieCameraOpen(false);
    } finally {
      setIsOpeningSelfieCamera(false);
    }
  }

  function closeSelfieCamera(): void {
    clearSelfieCamera();
    setIsSelfieCameraOpen(false);
  }

  async function captureSelfieFromCamera(): Promise<void> {
    if (!selfieVideoRef.current) {
      return;
    }

    try {
      setErrorMessage(null);
      setSuccessMessage(null);
      setIsUploadingSelfie(true);

      const blob = await blobFromVideo(selfieVideoRef.current);
      const file = new File([blob], `selfie-${Date.now()}.jpg`, {
        type: "image/jpeg"
      });

      setSelfieFile(file);
      closeSelfieCamera();
      await handleUpload({ file, type: "selfie" });
    } catch {
      setErrorMessage("Gagal mengambil foto selfie dari kamera.");
    } finally {
      setIsUploadingSelfie(false);
    }
  }

  async function openLivenessModal(): Promise<void> {
    if (!isKtpReady || !isSelfieReady) {
      return;
    }

    try {
      setErrorMessage(null);
      setSuccessMessage(null);
      setIsPreparingLiveness(true);
      resetLivenessState();
      clearLivenessSession();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      livenessStreamRef.current = stream;
  isLivenessOpenRef.current = true;
      setIsLivenessOpen(true);

      if (livenessVideoRef.current) {
        livenessVideoRef.current.srcObject = stream;
        await livenessVideoRef.current.play();
      }

      await ensureFaceLandmarker();
      runLivenessDetectionLoop();
    } catch {
      setErrorMessage("Liveness check tidak dapat dimulai. Periksa izin kamera lalu coba lagi.");
      clearLivenessSession();
      isLivenessOpenRef.current = false;
      setIsLivenessOpen(false);
    } finally {
      setIsPreparingLiveness(false);
    }
  }

  function closeLivenessModal(): void {
    isLivenessOpenRef.current = false;
    clearLivenessSession();
    setIsLivenessOpen(false);
  }

  useEffect(() => {
    let mounted = true;

    async function load(): Promise<void> {
      try {
        setIsLoadingOverview(true);
        const data = await getVerificationOverview();

        if (!mounted) {
          return;
        }

        setOverview(data);
        if (data.latestByType.liveness?.status === "verified") {
          const verifiedState = { ...initialLivenessState, blink: true, mouth_open: true, smile: true };
          livenessStepStateRef.current = verifiedState;
          setLivenessStepState(verifiedState);
          setLivenessStepIndex(livenessSteps.length - 1);
          setIsLivenessSuccess(true);
          updateLivenessHint("Liveness sudah terverifikasi oleh sistem.");
        }
      } catch {
        if (!mounted) {
          return;
        }

        setErrorMessage("Gagal memuat status verifikasi. Coba muat ulang halaman.");
      } finally {
        if (mounted) {
          setIsLoadingOverview(false);
        }
      }
    }

    void load();

    return () => {
      mounted = false;
      clearSelfieCamera();
      clearLivenessSession();
      faceLandmarkerRef.current?.close?.();
      faceLandmarkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    livenessStepStateRef.current = livenessStepState;

    const nextStepIndex = livenessSteps.findIndex((step) => !livenessStepState[step.id]);
    if (nextStepIndex === -1) {
      setLivenessStepIndex(livenessSteps.length - 1);
      setIsLivenessSuccess(true);
      return;
    }

    setLivenessStepIndex(nextStepIndex);
  }, [livenessStepState]);

  async function handleUpload(input: {
    file: File;
    type: "ktp_photo" | "selfie";
    side?: "front" | "back";
  }): Promise<void> {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (input.type === "ktp_photo" && input.side === "front") {
        setIsUploadingKtpFront(true);
      }

      if (input.type === "ktp_photo" && input.side === "back") {
        setIsUploadingKtpBack(true);
      }

      if (input.type === "selfie") {
        setIsUploadingSelfie(true);
      }

      await uploadVerificationFile(input);
      await refreshOverview();
      setSuccessMessage("File verifikasi berhasil disimpan.");
    } catch {
      setErrorMessage("Upload gagal. Pastikan format file benar dan coba lagi.");
    } finally {
      setIsUploadingKtpFront(false);
      setIsUploadingKtpBack(false);
      setIsUploadingSelfie(false);
    }
  }

  async function submitLivenessResult(): Promise<void> {
    if (!isLivenessSuccess) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      setIsSubmittingLiveness(true);
      await submitLivenessVerification({
        passed: true,
        steps: livenessSteps.map((step) => step.label),
        score: 1
      });
      await refreshOverview();
      setSuccessMessage("Liveness check berhasil direkam ke sistem.");
      closeLivenessModal();
    } catch {
      setErrorMessage("Gagal menyimpan hasil liveness. Coba lagi.");
    } finally {
      setIsSubmittingLiveness(false);
    }
  }

  return (
    <section className="space-y-8">
      <header className="rounded-3xl bg-surface-container-lowest p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-primary">Verifikasi Identitas</p>
        <h1 className="mt-3 text-3xl font-black text-on-surface sm:text-4xl">e-KYC Workflow</h1>
        <p className="mt-2 max-w-3xl text-sm text-on-surface-variant sm:text-base">
          Lengkapi upload e-KTP, selfie, lalu proses liveness check berbasis kamera dan deteksi wajah on-device.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {["Upload e-KTP", "Selfie", "Liveness"].map((step, index) => {
            const isDone = index === 0 ? isKtpReady : index === 1 ? isSelfieReady : isLivenessVerified;

            return (
              <article
                key={step}
                className="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant"
              >
                <div className="flex items-center gap-2">
                  {isDone ? (
                    <CheckCircle2 className="h-4 w-4 text-secondary" />
                  ) : (
                    <Circle className="h-4 w-4 text-outline" />
                  )}
                  <p className="font-semibold text-on-surface">{step}</p>
                </div>
              </article>
            );
          })}
        </div>

        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.08em] text-outline">
          Status KYC: {isLoadingOverview ? "Memuat..." : (overview?.kycStatus ?? "unverified")}
        </p>
      </header>

      {errorMessage ? (
        <div className="rounded-2xl border border-error/40 bg-error/10 px-4 py-3 text-sm font-medium text-error">{errorMessage}</div>
      ) : null}
      {successMessage ? (
        <div className="rounded-2xl border border-secondary/30 bg-secondary/10 px-4 py-3 text-sm font-medium text-secondary">
          {successMessage}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-7">
          <article className="rounded-3xl bg-surface-container-lowest p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-on-surface">Foto Depan e-KTP</h2>
              {isKtpReady ? <span className="text-xs font-bold text-secondary">Terverifikasi</span> : null}
            </div>

            <label className="flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-outline-variant/50 bg-surface-container-low p-5 text-center">
              <UploadCloud className="h-8 w-8 text-primary" />
              <p className="mt-3 text-sm font-semibold text-on-surface">
                {ktpFile ? ktpFile.name : "Ambil Foto atau Upload"}
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">Pastikan NIK dan teks terlihat jelas.</p>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setKtpFile(file);
                  if (file) {
                    void handleUpload({ file, type: "ktp_photo", side: "front" });
                  }
                }}
              />
            </label>
            {isUploadingKtpFront ? <p className="mt-2 text-xs text-on-surface-variant">Mengunggah...</p> : null}
          </article>

          <article className="rounded-3xl bg-surface-container-lowest p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-on-surface">Foto Belakang e-KTP</h2>
              <span className="text-xs text-on-surface-variant">Opsional</span>
            </div>

            <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-outline-variant/50 bg-surface-container-low p-5 text-center">
              <UploadCloud className="h-7 w-7 text-on-surface-variant" />
              <p className="mt-3 text-sm text-on-surface">{ktpBackFile ? ktpBackFile.name : "Klik untuk mengunggah"}</p>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setKtpBackFile(file);
                  if (file) {
                    void handleUpload({ file, type: "ktp_photo", side: "back" });
                  }
                }}
              />
            </label>
            {isUploadingKtpBack ? <p className="mt-2 text-xs text-on-surface-variant">Mengunggah...</p> : null}
          </article>
        </div>

        <aside className="space-y-6 xl:col-span-5">
          <article className="rounded-3xl bg-surface-container-lowest p-6">
            <h3 className="text-lg font-bold text-on-surface">Selfie & Liveness</h3>
            <p className="mt-2 text-sm text-on-surface-variant">Upload selfie lalu jalankan proses deteksi wajah.</p>

            <label className="mt-5 flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-outline-variant/50 bg-surface-container-low p-5 text-center">
              <Camera className="h-7 w-7 text-primary" />
              <p className="mt-3 text-sm font-semibold text-on-surface">
                {selfieFile ? selfieFile.name : "Upload selfie terbaru"}
              </p>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setSelfieFile(file);
                  if (file) {
                    void handleUpload({ file, type: "selfie" });
                  }
                }}
              />
            </label>

            <button
              type="button"
              onClick={() => void openSelfieCamera()}
              disabled={isOpeningSelfieCamera || isUploadingSelfie}
              className="mt-3 w-full rounded-xl bg-surface-container px-4 py-3 text-sm font-semibold text-on-surface disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isOpeningSelfieCamera ? "Membuka Kamera..." : "Buka Kamera Selfie"}
            </button>

            {isUploadingSelfie ? <p className="mt-2 text-xs text-on-surface-variant">Mengunggah...</p> : null}

            <button
              type="button"
              onClick={() => void openLivenessModal()}
              disabled={!isKtpReady || !isSelfieReady || isPreparingLiveness || isSubmittingLiveness}
              className="mt-4 w-full rounded-xl bg-gradient-to-r from-primary to-primary-container px-4 py-3 text-sm font-bold text-on-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPreparingLiveness
                ? "Menyiapkan Liveness..."
                : isLivenessVerified
                  ? "Liveness Terverifikasi"
                  : "Mulai Liveness Check"}
            </button>
          </article>

          <article className="rounded-3xl bg-surface-container p-6">
            <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-primary">Panduan Liveness Check</h3>
            <ul className="mt-4 space-y-3 text-sm text-on-surface-variant">
              <li className="flex items-start gap-2">
                <Sun className="mt-0.5 h-4 w-4 text-primary" />
                Pencahayaan harus cukup dan tidak membelakangi lampu.
              </li>
              <li className="flex items-start gap-2">
                <Eye className="mt-0.5 h-4 w-4 text-primary" />
                Lepas aksesoris yang menutupi area wajah.
              </li>
              <li className="flex items-start gap-2">
                <Crosshair className="mt-0.5 h-4 w-4 text-primary" />
                Posisikan wajah tepat di tengah frame saat instruksi muncul.
              </li>
            </ul>
          </article>
        </aside>
      </div>

      {isSelfieCameraOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#091229]/85 p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-gradient-to-br from-[#102347] to-[#07152f] p-6 text-white shadow-[0_24px_70px_rgba(7,21,47,0.8)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.08em] text-white/70">Kamera Selfie</p>
                <h3 className="text-2xl font-black">Ambil Selfie Sekarang</h3>
              </div>
              <button
                type="button"
                onClick={closeSelfieCamera}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white"
                aria-label="Tutup kamera selfie"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-white/15 bg-black/40">
              <video ref={selfieVideoRef} autoPlay muted playsInline className="h-[360px] w-full object-cover" />
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={closeSelfieCamera}
                className="rounded-xl bg-white/15 px-5 py-3 text-sm font-semibold text-white"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void captureSelfieFromCamera()}
                disabled={isUploadingSelfie}
                className="rounded-xl bg-[#1f59d8] px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isUploadingSelfie ? "Menyimpan..." : "Gunakan Foto Ini"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isLivenessOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#091229]/90 p-4">
          <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-gradient-to-br from-[#102347] to-[#07152f] p-6 text-white shadow-[0_24px_70px_rgba(7,21,47,0.8)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.08em] text-white/70">Sesi Keamanan</p>
                <h3 className="text-2xl font-black">Liveness Face Check</h3>
              </div>
              <button
                type="button"
                onClick={closeLivenessModal}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white"
                aria-label="Tutup liveness"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="overflow-hidden rounded-2xl border border-white/15 bg-black/40">
                <video ref={livenessVideoRef} autoPlay muted playsInline className="h-[360px] w-full object-cover" />
              </div>

              <div className="space-y-4 rounded-2xl bg-white/10 p-4">
                <p className="text-xs uppercase tracking-[0.08em] text-white/75">Instruksi Saat Ini</p>
                <p className="text-xl font-black">{isLivenessSuccess ? "Semua tantangan selesai" : currentInstruction}</p>
                <p className="text-sm text-white/85">{livenessHint}</p>

                <div className="h-2 w-full rounded-full bg-white/20">
                  <div
                    className="h-2 rounded-full bg-[#43e06f] transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <ul className="space-y-2 text-sm">
                  {livenessSteps.map((step, index) => {
                    const done = livenessStepState[step.id];
                    const isActive = !done && index === livenessStepIndex;

                    return (
                      <li
                        key={step.id}
                        className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
                          done ? "bg-[#43e06f]/25 text-white" : isActive ? "bg-white/15 text-white" : "bg-white/5 text-white/75"
                        }`}
                      >
                        {done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                        <span>{step.label}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={closeLivenessModal}
                className="rounded-xl bg-white/15 px-5 py-3 text-sm font-semibold text-white"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={() => void submitLivenessResult()}
                disabled={!isLivenessSuccess || isSubmittingLiveness}
                className="rounded-xl bg-[#1f59d8] px-6 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmittingLiveness ? "Menyimpan..." : "Simpan Hasil Verifikasi"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
