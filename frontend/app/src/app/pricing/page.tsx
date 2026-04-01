import Link from "next/link";

const plans = [
  {
    name: "Starter",
    price: "Rp 0",
    description: "Untuk individu yang baru memulai tanda tangan digital.",
    features: ["10 dokumen/bulan", "Basic e-KYC", "Audit log standar"]
  },
  {
    name: "Business",
    price: "Rp 299.000",
    description: "Workflow tim kecil-menengah dengan SLA prioritas.",
    features: ["500 dokumen/bulan", "Sequential signing", "Template dokumen"]
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "Skala besar dengan kebutuhan governance dan integrasi API.",
    features: ["Unlimited dokumen", "RBAC lanjutan", "Dedicated account manager"]
  }
];

export default function PricingPage() {
  return (
    <main className="min-h-dvh bg-background px-4 py-12 sm:px-6">
      <section className="mx-auto w-full max-w-6xl space-y-8">
        <header className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-primary">Pricing Plans</p>
          <h1 className="mt-3 text-4xl font-black text-on-surface sm:text-5xl">Pilih Paket Sesuai Skala Bisnis</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-on-surface-variant sm:text-base">
            Semua paket sudah termasuk legal audit trail, workflow approval, dan dashboard monitoring real-time.
          </p>
        </header>

        <div className="grid gap-5 md:grid-cols-3">
          {plans.map((plan, index) => (
            <article
              key={plan.name}
              className={`rounded-3xl p-6 ${
                index === 1
                  ? "bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-[0_16px_45px_rgba(0,61,155,0.32)]"
                  : "bg-surface-container-lowest text-on-surface"
              }`}
            >
              <h2 className="text-2xl font-black">{plan.name}</h2>
              <p className={`mt-2 text-3xl font-black ${index === 1 ? "text-on-primary" : "text-primary"}`}>{plan.price}</p>
              <p className={`mt-3 text-sm ${index === 1 ? "text-on-primary-container" : "text-on-surface-variant"}`}>
                {plan.description}
              </p>
              <ul className="mt-4 space-y-2 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature}>• {feature}</li>
                ))}
              </ul>

              <Link
                href="/register"
                className={`mt-6 inline-flex rounded-xl px-4 py-3 text-sm font-bold ${
                  index === 1 ? "bg-white text-[#0f1c33]" : "bg-primary text-on-primary"
                }`}
              >
                Pilih Paket
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
