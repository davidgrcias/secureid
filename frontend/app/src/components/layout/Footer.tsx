export default function Footer() {
  return (
    <footer className="border-t border-outline-variant/20 bg-surface py-6">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-3 px-4 text-xs text-on-surface-variant sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>Copyright 2026 PT SecureID Indonesia</p>
        <div className="flex items-center gap-4">
          <span>Privacy</span>
          <span>Terms</span>
          <span>Contact</span>
        </div>
      </div>
    </footer>
  );
}
