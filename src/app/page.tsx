"use client";

import { useState } from "react";
import { supabase } from "@/utils/supabase/client";

const flow = [
  {
    step: "01",
    label: "Seed",
    title: "Capture the possibility",
    text: "Keep a book, place, skill, idea or private possibility before it disappears from your head.",
    tone: "bg-emerald-50 border-emerald-200",
  },
  {
    step: "02",
    label: "Intent",
    title: "Say what you actually want to do",
    text: "Give the possibility a time, place and context so it can become something other people can understand and join.",
    tone: "bg-blue-50 border-blue-200",
  },
  {
    step: "03",
    label: "People",
    title: "Find who wants the same thing",
    text: "UIN looks for shared Intent and compatible context instead of asking you to browse random profiles and hope for chemistry.",
    tone: "bg-cyan-50 border-cyan-200",
  },
  {
    step: "04",
    label: "Plan",
    title: "Turn a match into a shared plan",
    text: "Agree on the schedule, locations, people, budget, weather context and what everyone needs to bring.",
    tone: "bg-violet-50 border-violet-200",
  },
  {
    step: "05",
    label: "Activity",
    title: "Go live it",
    text: "The point is not to spend more time in UIN. It is to make the thing happen somewhere outside the screen.",
    tone: "bg-amber-50 border-amber-200",
  },
  {
    step: "06",
    label: "Experience",
    title: "Keep what remains",
    text: "Record what happened, what you learned and what might become the next Seed for you or someone else.",
    tone: "bg-rose-50 border-rose-200",
  },
];

const reasons = [
  {
    icon: "↗",
    title: "Start with what you want to do",
    text: "Your social circle should not decide the limits of your life. Open the Intent first, then find the people who genuinely want the same thing.",
  },
  {
    icon: "◎",
    title: "Find people for a reason",
    text: "A concert, a match, a trip, a walk, a workshop, a book or a strange little project already gives people a real reason to meet.",
  },
  {
    icon: "⌖",
    title: "Match on real context",
    text: "Shared interest is not enough. Dates, place, availability, communities and participation preferences help surface people who can actually be there.",
  },
  {
    icon: "→",
    title: "Leave with something real",
    text: "UIN is designed to move from discovery to a shared plan and then into real life, instead of keeping the connection trapped inside a feed or chat.",
  },
];

const trustPoints = [
  "Choose who can see each Intent and Seed.",
  "Join Requests come before shared planning.",
  "Private planning details stay inside the Plan.",
  "Reputation is based on real shared context, not popularity.",
];

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.23-.2-1.78h-9.2v3.34h5.4a4.6 4.6 0 0 1-2 3.02l-.03.11 2.9 2.24.2.02c1.84-1.7 2.93-4.2 2.93-6.95Z"
      />
      <path
        fill="#34A853"
        d="M12.2 21.8c2.64 0 4.85-.87 6.47-2.62l-3.08-2.37c-.82.55-1.93.94-3.39.94a5.88 5.88 0 0 1-5.57-4.06l-.1.01-3.02 2.34-.04.1A9.78 9.78 0 0 0 12.2 21.8Z"
      />
      <path
        fill="#FBBC05"
        d="M6.63 13.69a6.05 6.05 0 0 1-.33-1.96c0-.68.12-1.34.32-1.96v-.12L3.56 7.28l-.1.05a9.8 9.8 0 0 0 0 8.81l3.17-2.45Z"
      />
      <path
        fill="#EA4335"
        d="M12.2 5.72c1.84 0 3.08.8 3.8 1.46l2.73-2.66C17.05 2.96 14.84 2 12.2 2a9.78 9.78 0 0 0-8.73 5.33l3.15 2.44A5.9 5.9 0 0 1 12.2 5.72Z"
      />
    </svg>
  );
}

function SignInButton({
  isLoading,
  onClick,
  compact = false,
}: {
  isLoading: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      className={`inline-flex items-center justify-center gap-3 rounded-xl bg-[#08a849] font-semibold text-white shadow-[0_12px_30px_rgba(8,168,73,0.18)] transition hover:-translate-y-0.5 hover:bg-[#078f3f] disabled:cursor-not-allowed disabled:opacity-60 ${
        compact ? "px-5 py-3 text-sm" : "w-full px-6 py-4 text-base sm:w-auto sm:min-w-64"
      }`}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white">
        <GoogleMark />
      </span>
      {isLoading ? "Connecting..." : "Continue with Google"}
    </button>
  );
}

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const signInWithGoogle = async () => {
    if (isLoading) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const redirectTo = `${window.location.origin}/auth/callback`;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data.url) throw new Error("Google sign-in URL could not be created.");

      window.location.assign(data.url);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong while starting Google sign-in.";

      console.error("Google sign-in error:", error);
      setErrorMessage(message);
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#fbfcfa] text-[#111713]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[720px] overflow-hidden">
        <div className="absolute -left-24 top-28 h-80 w-80 rounded-full bg-emerald-100/70 blur-3xl" />
        <div className="absolute -right-20 top-12 h-96 w-96 rounded-full bg-blue-100/60 blur-3xl" />
        <div className="absolute left-1/2 top-52 h-80 w-80 -translate-x-1/2 rounded-full bg-lime-100/45 blur-3xl" />
      </div>

      <header className="relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <a href="#top" className="flex items-center gap-3" aria-label="UIN home">
          <img src="/uin-logo.png" alt="uin?" className="h-12 w-auto" />
        </a>

        <nav className="hidden items-center gap-7 text-sm font-medium text-gray-600 md:flex">
          <a href="#why" className="transition hover:text-black">Why UIN</a>
          <a href="#how" className="transition hover:text-black">How it works</a>
          <a href="#trust" className="transition hover:text-black">Trust & privacy</a>
        </nav>

        <SignInButton isLoading={isLoading} onClick={signInWithGoogle} compact />
      </header>

      <section id="top" className="relative z-10 mx-auto grid min-h-[680px] max-w-7xl items-center gap-12 px-5 pb-20 pt-12 sm:px-8 lg:grid-cols-[1.03fr_0.97fr] lg:px-10 lg:pt-20">
        <div className="max-w-2xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/85 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 shadow-sm backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            The Intent Network
          </div>

          <h1 className="text-5xl font-black leading-[0.98] tracking-[-0.055em] text-[#101410] sm:text-6xl lg:text-[74px]">
            Your next real-life experience
            <span className="mt-2 block text-[#08a849]">can start here.</span>
          </h1>

          <p className="mt-7 max-w-2xl text-lg leading-8 text-gray-600 sm:text-xl">
            You already know what you want to do. The hard part is often finding the right people who want the same thing, at the right time, in the right place. UIN starts with Intent and helps turn that shared direction into something real.
          </p>

          <div className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <SignInButton isLoading={isLoading} onClick={signInWithGoogle} />
            <a href="#how" className="rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-white hover:text-black">
              See how UIN works ↓
            </a>
          </div>

          {errorMessage && (
            <p role="alert" className="mt-5 max-w-xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </p>
          )}

          <p className="mt-7 text-sm font-semibold leading-6 text-gray-600">
            Start with the thing you want to do, not with the people you happen to know.
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-[590px] lg:mx-0">
          <div className="absolute -inset-8 rounded-[42px] bg-gradient-to-br from-emerald-200/50 via-white/10 to-blue-200/45 blur-2xl" />
          <div className="relative rounded-[32px] border border-gray-200/90 bg-white/92 p-5 shadow-[0_30px_80px_rgba(20,40,25,0.13)] backdrop-blur sm:p-7">
            <div className="flex items-center justify-between border-b border-gray-100 pb-5">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-600">Intent first</div>
                <h2 className="mt-1 text-2xl font-black tracking-tight">What do you want to do?</h2>
              </div>
              <span className="rounded-full bg-gray-950 px-3 py-1.5 text-xs font-bold text-white">U in?</span>
            </div>

            <div className="mt-6 space-y-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Seed</div>
                    <div className="mt-1 font-bold">Visit Eskişehir by train</div>
                    <div className="mt-1 text-xs text-gray-500">A possibility worth keeping.</div>
                  </div>
                  <span className="text-2xl">🌱</span>
                </div>
              </div>

              <div className="ml-7 border-l-2 border-dashed border-gray-200 pl-5">
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">Intent</div>
                      <div className="mt-1 font-bold">Weekend train trip to Eskişehir</div>
                      <div className="mt-1 text-xs text-gray-500">Now find people who want it too.</div>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-blue-700">OPEN</span>
                  </div>
                </div>
              </div>

              <div className="ml-14 border-l-2 border-dashed border-gray-200 pl-5">
                <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div><div className="text-[10px] font-bold uppercase text-gray-400">People</div><div className="mt-1 font-black">4</div></div>
                    <div><div className="text-[10px] font-bold uppercase text-gray-400">Schedule</div><div className="mt-1 font-black">Sat 09:30</div></div>
                    <div><div className="text-[10px] font-bold uppercase text-gray-400">Weather</div><div className="mt-1 font-black">☀️ 18°</div></div>
                  </div>
                </div>
              </div>

              <div className="ml-20 rounded-2xl bg-[#101410] p-4 text-white">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">Activity</div>
                    <div className="mt-1 font-bold">Now it is real.</div>
                  </div>
                  <div className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold">Completed ✓</div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3 border-t border-gray-100 pt-5 text-center">
              <div><div className="text-xl font-black">Intent</div><div className="text-[11px] text-gray-400">what you want</div></div>
              <div><div className="text-xl font-black">People</div><div className="text-[11px] text-gray-400">who want it too</div></div>
              <div><div className="text-xl font-black">Activity</div><div className="text-[11px] text-gray-400">what became real</div></div>
            </div>
          </div>
        </div>
      </section>

      <section id="why" className="relative z-10 border-y border-gray-200 bg-white py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="max-w-3xl">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">The problem</div>
            <h2 className="mt-3 text-4xl font-black tracking-[-0.04em] sm:text-5xl">You want to do something. You just cannot always find the right people to do it with.</h2>
            <p className="mt-5 max-w-4xl text-lg leading-8 text-gray-600">
              Your friends may be busy. They may not care about the same concert, trip, sport, book or idea. And browsing random profiles is a remarkably inefficient way to solve that. UIN starts with the reason to meet: a shared Intent.
            </p>
            <div className="mt-7 grid max-w-4xl gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Traditional networks</div>
                <div className="mt-2 font-bold text-gray-700">People first → hope you find a reason to connect.</div>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">UIN</div>
                <div className="mt-2 font-black text-[#0b6f35]">Intent first → find people who already share the reason.</div>
              </div>
            </div>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {reasons.map((reason) => (
              <article key={reason.title} className="rounded-3xl border border-gray-200 bg-[#fbfcfa] p-6 transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-lg">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#101410] text-xl font-black text-white">{reason.icon}</div>
                <h3 className="mt-6 text-xl font-black tracking-tight">{reason.title}</h3>
                <p className="mt-3 text-sm leading-6 text-gray-600">{reason.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="relative z-10 py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="max-w-3xl">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">How it works</div>
              <h2 className="mt-3 text-4xl font-black tracking-[-0.04em] sm:text-5xl">Do not search for people. Share what you want to do.</h2>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-600">
                UIN helps the right people emerge around the Intent, then gives them enough real-world context to turn interest into a plan. The connection has somewhere to go.
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 text-sm font-semibold text-gray-600 shadow-sm">Seed → Intent → People → Plan → Activity → Experience</div>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {flow.map((item) => (
              <article key={item.label} className={`relative rounded-3xl border p-5 ${item.tone}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">{item.step}</span>
                  <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-gray-700">{item.label}</span>
                </div>
                <h3 className="mt-8 text-xl font-black tracking-tight">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-gray-600">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 bg-[#111713] py-24 text-white">
        <div className="mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-10">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Built for real life</div>
            <h2 className="mt-3 text-4xl font-black tracking-[-0.04em] sm:text-5xl">The point is to leave the app.</h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-gray-300">
              UIN is not designed to keep you scrolling. It is designed to help you find something worth closing the app for, with people who are actually in.
            </p>
            <p className="mt-6 max-w-xl text-base font-bold leading-7 text-emerald-200">Find something to do. Find the right people. Go live it.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="text-3xl">🌱</div>
              <h3 className="mt-5 text-xl font-black">Start privately when you need to</h3>
              <p className="mt-3 text-sm leading-6 text-gray-300">Private Seeds give unfinished thoughts somewhere to live until you decide they are ready to become Intent.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="text-3xl">☀️</div>
              <h3 className="mt-5 text-xl font-black">Know whether people can actually join</h3>
              <p className="mt-3 text-sm leading-6 text-gray-300">Dates, locations, weather, availability and participation context turn vague interest into a realistic possibility.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="text-3xl">🧭</div>
              <h3 className="mt-5 text-xl font-black">Meet around a reason</h3>
              <p className="mt-3 text-sm leading-6 text-gray-300">People are easier to connect with when there is already a concert, walk, trip, match, idea or project worth showing up for.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="text-3xl">◌</div>
              <h3 className="mt-5 text-xl font-black">Build trust through what became real</h3>
              <p className="mt-3 text-sm leading-6 text-gray-300">Shared Activity history can build useful context without reducing a person to followers, likes or one meaningless popularity number.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="trust" className="relative z-10 py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:px-10">
          <div className="rounded-[32px] border border-gray-200 bg-white p-7 shadow-sm sm:p-9">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-violet-600">Trust & privacy</div>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] sm:text-4xl">Social when useful. Private when necessary.</h2>
            <p className="mt-5 text-base leading-7 text-gray-600">
              Not every thought belongs in public, and not every plan should expose every detail. Visibility changes as an idea becomes a shared Activity.
            </p>
            <div className="mt-8 space-y-3">
              {trustPoints.map((point) => (
                <div key={point} className="flex items-start gap-3 rounded-2xl bg-gray-50 px-4 py-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-black text-emerald-700">✓</span>
                  <span className="text-sm font-medium text-gray-700">{point}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col justify-center rounded-[32px] border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-7 sm:p-9">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">What UIN is not</div>
            <div className="mt-6 space-y-5">
              <div className="border-l-4 border-gray-950 pl-5"><div className="font-black">Not a people browser.</div><p className="mt-1 text-sm leading-6 text-gray-600">The question is not “who looks interesting?” It is “who wants to do this too?”</p></div>
              <div className="border-l-4 border-gray-950 pl-5"><div className="font-black">Not a content network.</div><p className="mt-1 text-sm leading-6 text-gray-600">Experiences can be shared, but publishing content is not the product’s main loop.</p></div>
              <div className="border-l-4 border-gray-950 pl-5"><div className="font-black">Not another profile contest.</div><p className="mt-1 text-sm leading-6 text-gray-600">Your profile is a record of direction and experience, not a competition for vanity metrics.</p></div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 px-5 pb-24 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[36px] bg-gradient-to-br from-[#087a3a] via-[#08a849] to-[#59b80f] px-6 py-14 text-center text-white shadow-[0_30px_90px_rgba(8,140,66,0.25)] sm:px-10 sm:py-16">
          <img src="/uin-logo.png" alt="uin?" className="mx-auto h-20 w-auto rounded-2xl bg-white/95 px-3 py-2" />
          <h2 className="mx-auto mt-7 max-w-3xl text-4xl font-black tracking-[-0.04em] sm:text-5xl">Your next real-life experience can start here.</h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/85">Tell UIN what you want to do. Find people who want it too. Make the plan. Go live it.</p>
          <div className="mt-8 flex justify-center">
            <SignInButton isLoading={isLoading} onClick={signInWithGoogle} />
          </div>
          <p className="mt-5 text-xs font-medium text-white/70">Are you in?</p>
        </div>
      </section>

      <footer className="relative z-10 border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-7 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <img src="/uin-logo.png" alt="uin?" className="h-8 w-auto" />
            <span>Find the right people for what you want to do.</span>
          </div>
          <span>UIN · Intent Network</span>
        </div>
      </footer>
    </main>
  );
}
