import { Code2, Shield, Cpu, Workflow } from "lucide-react";
import { NumscriptEngine } from "@/components/NumscriptEngine";

export default function Home() {
  return (
    <div className="min-h-screen grid-bg">
      <div className="glow min-h-screen">
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
          {/* Header */}
          <header className="mb-12 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm font-medium text-emerald-400">
              <Cpu className="h-3.5 w-3.5" />
              Powered by OpenAI
            </div>
            <h1 className="mb-3 text-4xl font-bold tracking-tight text-zinc-100 sm:text-5xl">
              Numscript{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                Engine
              </span>
            </h1>
            <p className="mx-auto max-w-xl text-lg text-zinc-400">
              Transform natural language into type-safe Formance Numscript.
              Define your Chart of Accounts, describe transactions, get code.
            </p>
          </header>

          {/* Main Engine */}
          <main className="mb-20 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-sm lg:p-8">
            <NumscriptEngine />
          </main>

          {/* Architecture */}
          <section className="mb-16">
            <h2 className="mb-8 text-center text-sm font-medium uppercase tracking-wider text-zinc-500">
              Pipeline Architecture
            </h2>
            <div className="grid gap-4 sm:grid-cols-4">
              {[
                {
                  step: "1",
                  title: "Input",
                  desc: "Natural language command",
                  icon: Code2,
                },
                {
                  step: "2",
                  title: "Reasoning",
                  desc: "AI → JSON Intent",
                  icon: Cpu,
                },
                {
                  step: "3",
                  title: "Validation",
                  desc: "Zod schema check",
                  icon: Shield,
                },
                {
                  step: "4",
                  title: "Compile",
                  desc: "JSON → Numscript",
                  icon: Workflow,
                },
              ].map(({ step, title, desc, icon: Icon }) => (
                <div
                  key={step}
                  className="relative rounded-xl border border-zinc-800 bg-zinc-900/30 p-5"
                >
                  <div className="absolute -top-3 left-4 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-zinc-950">
                    {step}
                  </div>
                  <Icon className="mb-3 h-5 w-5 text-zinc-400" />
                  <h3 className="font-semibold text-zinc-200">{title}</h3>
                  <p className="text-sm text-zinc-500">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Footer */}
          <footer className="border-t border-zinc-800 pt-8 text-center">
            <p className="text-sm text-zinc-600">
              Built for{" "}
              <a
                href="https://formance.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-400 underline-offset-4 hover:underline"
              >
                Formance Ledger
              </a>{" "}
              • Natural Language → Numscript Engine
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}

