import Link from "next/link";

type AuthLayoutProps = {
  children: React.ReactNode;
};

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="min-h-dvh bg-[radial-gradient(circle_at_top,_#ffffff_0%,_#eff4ff_45%,_#e5eeff_100%)] px-4 py-10 sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 md:py-12">
        <header className="flex items-center justify-between">
          <Link href="/" className="text-3xl font-black tracking-tight text-primary">
            SecureID
          </Link>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
            End-to-end encryption
          </p>
        </header>

        {children}
      </div>
    </main>
  );
}
