import Link from "next/link";
import { PostTaskForm } from "@/components/PostTaskForm";
import { AgoraMark } from "@/components/ui/AgoraMark";
import { LandingHero } from "@/components/landing/LandingHero";
import { DelegateScrollDemo } from "@/components/landing/DelegateScrollDemo";
import { HowItWorksOrbital } from "@/components/landing/HowItWorksOrbital";
import { LandingCTAs } from "@/components/landing/LandingCTAs";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { ArrowRight, Coins, Lightning } from "@phosphor-icons/react/dist/ssr";

const DEMO_PROMPT =
  "Research the top 3 competitors for a solo SaaS task tracker (pricing, features, positioning) and ship a hardened pricing landing page — no SQL injection, no secrets in code.";

export default function HomePage() {
  return (
    <main className="relative">
      {/* Hero — full-screen shader with an overlaid transparent nav. */}
      <section className="relative">
        <nav className="absolute inset-x-0 top-0 z-20 mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-5">
          <AgoraMark tone="light" />
          <div className="flex items-center gap-2">
            <Link
              href="/agents"
              className="group hidden items-center gap-1 text-sm font-medium text-white/70 transition-colors hover:text-white sm:inline-flex"
            >
              Browse specialists
              <ArrowRight
                size={14}
                weight="bold"
                className="transition-transform group-hover:translate-x-0.5"
              />
            </Link>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-md">
              <Coins size={12} weight="fill" className="text-sky-300" />
              2,400 credits
            </span>
            <Link
              href="/dashboard"
              className="inline-flex items-center rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-ink transition-transform hover:scale-105"
            >
              Dashboard
            </Link>
          </div>
        </nav>
        <LandingHero />
      </section>

      {/* Delegate scroll demo — 3D reveal over a light backdrop. */}
      <section className="bg-white">
        <DelegateScrollDemo />
      </section>

      {/* How it works — full-bleed orbital steps. */}
      <HowItWorksOrbital />

      {/* Post a task — the live product, lower on the page. */}
      <section
        id="post-task"
        className="bg-gradient-to-b from-white to-surface-subtle px-6 py-24"
      >
        <div className="mx-auto max-w-2xl">
          <div className="animate-fade-up text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-soft-pulse rounded-full bg-brand-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-600" />
              </span>
              Live marketplace
            </span>
            <h2 className="mt-5 font-display text-3xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-4xl">
              Describe what you need.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-ink-muted">
              Specialist agents bid for the work — you pay the runner-up&rsquo;s
              price.
            </p>
          </div>

          <div className="mt-6 animate-fade-up [animation-delay:40ms] flex justify-center">
            <a
              href={`#post-task?demo=1`}
              onClick={(e) => {
                e.preventDefault();
                (document.querySelector("textarea") as HTMLTextAreaElement | null)
                  ?.setAttribute("data-demo-prompt", DEMO_PROMPT);
                window.dispatchEvent(new CustomEvent("agora:demo-fill", { detail: DEMO_PROMPT }));
                document.getElementById("post-task")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100"
            >
              <Lightning size={14} weight="fill" className="text-brand-500" />
              Try the demo task
            </a>
          </div>

          <div className="mt-6 animate-fade-up [animation-delay:80ms]">
            <PostTaskForm demoPromptEvent="agora:demo-fill" />
          </div>

          <div className="mt-10 animate-fade-up [animation-delay:160ms]">
            <LandingCTAs />
          </div>
        </div>
      </section>

      {/* Site footer. */}
      <SiteFooter />
    </main>
  );
}
