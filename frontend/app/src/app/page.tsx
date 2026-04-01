import Link from "next/link";
import Footer from "@/components/layout/Footer";
import TopNav from "@/components/layout/TopNav";

export default function Home() {
  return (
    <div className="min-h-dvh bg-background">
      <TopNav variant="public" />

      <main>
        <section className="mx-auto grid w-full max-w-[1440px] items-center gap-12 px-4 pb-16 pt-12 sm:px-6 md:grid-cols-2 md:py-20">
          <div className="space-y-8">
            <span className="inline-flex rounded-full bg-primary/10 px-4 py-1 text-xs font-bold uppercase tracking-[0.08em] text-primary">
              Terakreditasi Kominfo
            </span>
            <div className="space-y-4">
              <h1 className="text-4xl font-black leading-tight tracking-tight text-on-surface sm:text-6xl">
                Digital Trust Starts with Your SecureID
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-on-surface-variant sm:text-lg">
                Verifikasi identitas dan tanda tangan digital legal dalam satu platform untuk bisnis modern.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="rounded-xl bg-gradient-to-r from-primary to-primary-container px-6 py-3 text-sm font-bold text-on-primary shadow-[0_12px_30px_rgba(0,61,155,0.3)]"
              >
                Masuk Dashboard
              </Link>
              <Link
                href="/pricing"
                className="rounded-xl bg-surface-container-lowest px-6 py-3 text-sm font-semibold text-on-surface shadow-[0_8px_24px_rgba(17,28,42,0.08)]"
              >
                Lihat Paket
              </Link>
            </div>
          </div>

          <div className="relative rounded-[2rem] bg-surface-container-lowest p-5 shadow-[0_24px_60px_rgba(17,28,42,0.15)]">
            <div className="h-[380px] rounded-[1.5rem] bg-gradient-to-br from-[#0F1C33] via-[#162B4B] to-[#1C3C73] p-6">
              <p className="text-sm font-semibold text-on-primary-container">Dashboard Preview</p>
              <div className="mt-6 grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-white/10 p-3 text-xs text-white/90">Workflow Dokumen</div>
                <div className="rounded-xl bg-white/10 p-3 text-xs text-white/90">Aksi Penandatangan</div>
                <div className="rounded-xl bg-white/10 p-3 text-xs text-white/90">Audit Trail</div>
              </div>
              <div className="mt-6 rounded-2xl bg-white/8 p-5">
                <p className="text-xs uppercase tracking-[0.08em] text-white/80">Aktivitas Terkini</p>
                <div className="mt-4 space-y-3">
                  <div className="h-3 w-full rounded-full bg-white/20" />
                  <div className="h-3 w-5/6 rounded-full bg-white/20" />
                  <div className="h-3 w-2/3 rounded-full bg-white/20" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
