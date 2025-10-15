import { ComparisonExperience } from "@/components/comparison/comparison-experience";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col px-4 py-12 md:py-20">
      <div className="relative overflow-hidden rounded-[32px] border border-white/30 bg-white/75 p-[1px] shadow-[0_20px_60px_-35px_rgba(15,23,42,0.8)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/50">
        <div className="pointer-events-none absolute inset-0 rounded-[32px] bg-gradient-to-br from-white/60 via-transparent to-cyan-100/30 dark:from-slate-800/60 dark:via-transparent dark:to-indigo-900/30" />
        <div className="relative z-10 rounded-[30px] bg-white/80 p-6 shadow-inner dark:bg-slate-950/40 sm:p-10 md:p-12">
          <ComparisonExperience />
        </div>
      </div>
    </main>
  );
}
