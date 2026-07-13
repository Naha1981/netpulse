import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="flex-1">
      <header className="max-w-6xl mx-auto px-6 pt-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: "var(--signal)" }}
          />
          <span className="font-semibold tracking-tight">NetPulse AI</span>
        </div>
        <nav className="flex items-center gap-3">
          <Link href="/login" className="btn-secondary text-sm">
            Log in
          </Link>
          <Link href="/signup" className="btn-primary text-sm">
            Get started
          </Link>
        </nav>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <p className="mono text-xs tracking-widest uppercase" style={{ color: "var(--signal)" }}>
            For South African WISPs &amp; small ISPs
          </p>
          <h1 className="mt-4 text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.1]">
            From Excel to an AI-powered ISP operations view — in under 15 minutes.
          </h1>
          <p className="mt-6 text-lg" style={{ color: "var(--text-dim)" }}>
            Upload the spreadsheet you already have. NetPulse AI reads it,
            proposes the field mapping, finds the duplicate IPs and orphaned
            equipment you didn&apos;t know about, and hands you a health
            report — no sales call, no consultant, no migration project.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="btn-primary">
              Upload a spreadsheet, free
            </Link>
            <a href="#how-it-works" className="btn-secondary">
              See how it works
            </a>
          </div>
        </div>

        <div className="card p-6" aria-hidden="true">
          <div className="flex items-center justify-between mono text-xs" style={{ color: "var(--text-dim)" }}>
            <span>AI HEALTH REPORT</span>
            <span className="flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--online)" }}
              />
              generated in 42s
            </span>
          </div>
          <p className="mt-4 text-sm leading-relaxed">
            We reviewed 1,204 customer and IP records from your import.
          </p>
          <ul className="mt-4 space-y-2.5 text-sm">
            <HealthLine severity="danger" label="6 duplicate IP addresses" />
            <HealthLine severity="warn" label="18 devices with no assigned customer" />
            <HealthLine severity="warn" label="12 warranties already expired" />
            <HealthLine severity="online" label="No missing customer records" />
          </ul>
          <div className="mt-5 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
            <p className="text-sm" style={{ color: "var(--text-dim)" }}>
              Recommended next step: reassign the 6 duplicate IPs before your
              next installation to avoid a conflict.
            </p>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-16 border-t" style={{ borderColor: "var(--border)" }}>
        <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
        <div className="mt-8 grid sm:grid-cols-3 gap-6">
          <Step
            n="1"
            title="Upload what you have"
            body="Excel, CSV, or a Google Sheets export. Customers, IPs, or equipment — whatever's in the file."
          />
          <Step
            n="2"
            title="AI maps and cleans it"
            body="No mapping screens. The AI proposes field matches and flags duplicates, invalid IPs, and missing data for your review."
          />
          <Step
            n="3"
            title="Get your health report"
            body="A plain-language summary of what's wrong and what to fix first — the same day you sign up."
          />
        </div>
      </section>

      <footer className="max-w-6xl mx-auto px-6 py-10 border-t text-sm" style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}>
        NetPulse AI — built for Southern African ISPs and WISPs.
      </footer>
    </main>
  );
}

function HealthLine({
  severity,
  label,
}: {
  severity: "danger" | "warn" | "online";
  label: string;
}) {
  const color = { danger: "var(--danger)", warn: "var(--warn)", online: "var(--online)" }[severity];
  return (
    <li className="flex items-center gap-2.5">
      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: color }} />
      <span style={{ color: "var(--text-dim)" }}>{label}</span>
    </li>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="card p-5">
      <span className="mono text-xs" style={{ color: "var(--signal)" }}>
        {n}
      </span>
      <h3 className="mt-2 font-medium">{title}</h3>
      <p className="mt-2 text-sm" style={{ color: "var(--text-dim)" }}>
        {body}
      </p>
    </div>
  );
}
