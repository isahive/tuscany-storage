"use client";

import Link from "next/link";
import { useState } from "react";

const SIZES = [
  "5×5",
  "5×10",
  "10×10",
  "10×15",
  "10×20",
  "10×30",
  "12×25 (Vehicle)",
];
const TYPES = [
  { value: "standard", label: "Standard" },
  { value: "climate_controlled", label: "Climate Controlled" },
  { value: "drive_up", label: "Drive-Up" },
  { value: "vehicle_outdoor", label: "Vehicle Storage" },
];

type FormState = "idle" | "submitting" | "success" | "error";

interface FormData {
  name: string;
  email: string;
  phone: string;
  preferredSize: string;
  preferredType: string;
  desiredMoveInDate: string;
  notes: string;
  smsOptIn: boolean;
}

export default function WaitingListPage() {
  const [form, setForm] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    preferredSize: "",
    preferredType: "",
    desiredMoveInDate: "",
    notes: "",
    smsOptIn: false,
  });
  const [state, setState] = useState<FormState>("idle");

  function update(field: keyof FormData, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("submitting");

    try {
      const res = await fetch('/api/public/waiting-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to submit')
      setState('success')
    } catch (err) {
      setState('error')
    }
  }

  return (
    <>
      {/* Header */}
      <div className="bg-brown py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="font-serif text-4xl font-bold text-cream sm:text-5xl">
            Waiting List
          </h1>
          <p className="mt-3 max-w-xl text-cream/60">
            All units occupied? Tell us what you need and we&apos;ll contact you
            the moment something opens up.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-5">
          {/* Info sidebar */}
          <div className="lg:col-span-2 space-y-8">
            {/* How it works */}
            <div>
              <h2 className="font-serif text-2xl font-bold text-brown">
                How the waiting list works
              </h2>
              <div className="mt-5 space-y-5">
                {[
                  {
                    n: "1",
                    title: "Submit your info",
                    body: "Tell us the size and type of unit you need, along with your preferred move-in date.",
                  },
                  {
                    n: "2",
                    title: "We'll notify you first",
                    body: "When a matching unit opens, you'll be contacted by email and text (if opted in) before we list it publicly.",
                  },
                  {
                    n: "3",
                    title: "Reserve your unit",
                    body: "You'll have 48 hours to confirm your reservation before we move to the next person on the list.",
                  },
                ].map((step) => (
                  <div key={step.n} className="flex gap-4">
                    <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full border border-tan/30 bg-tan/10 text-sm font-bold text-tan">
                      {step.n}
                    </div>
                    <div>
                      <p className="font-semibold text-brown">{step.title}</p>
                      <p className="mt-0.5 text-sm text-muted">{step.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Wait times */}
            <div className="rounded-xl bg-cream border border-mid p-5">
              <h3 className="mb-3 font-semibold text-brown">
                Typical Wait Times
              </h3>
              <div className="space-y-2 text-sm">
                {[
                  ["5×5 Standard", "1–2 weeks"],
                  ["10×10 Standard", "2–3 weeks"],
                  ["10×10 Climate", "3–4 weeks"],
                  ["Drive-Up", "2–4 weeks"],
                  ["Vehicle Storage", "1–2 weeks"],
                ].map(([type, time]) => (
                  <div key={type} className="flex justify-between">
                    <span className="text-muted">{type}</span>
                    <span className="font-medium text-brown">{time}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted">
                * Times vary based on demand. Joining the list costs nothing.
              </p>
            </div>

            {/* Contact */}
            <div className="text-sm text-muted">
              <p>Have an urgent need?</p>
              <a
                href="tel:+18654262100"
                className="font-semibold text-tan hover:underline"
              >
                Call us at (865) 426-2100
              </a>
              <p className="mt-0.5">and we&apos;ll do our best to help.</p>
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-3">
            {state === "success" ? (
              <div className="rounded-2xl border border-mid bg-white p-10 text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-olive/10">
                  <svg
                    className="h-8 w-8 text-olive"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                </div>
                <h2 className="font-serif text-2xl font-bold text-brown">
                  You&apos;re on the list!
                </h2>
                <p className="mt-3 max-w-sm mx-auto text-muted">
                  We have your info and will reach out as soon as a matching
                  unit becomes available. You&apos;ll hear from us by email
                  {form.smsOptIn ? " and text" : ""}.
                </p>
                <div className="mt-6 space-y-3">
                  <p className="text-sm text-muted">
                    While you wait, check out our current availability or size
                    guide.
                  </p>
                  <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                    <Link
                      href="/units"
                      className="w-full rounded bg-tan px-6 py-2.5 font-semibold text-brown hover:bg-tan-light transition-colors sm:w-auto"
                    >
                      View Available Units
                    </Link>
                    <Link
                      href="/size-guide"
                      className="w-full rounded border border-mid px-6 py-2.5 font-semibold text-brown hover:border-tan transition-colors sm:w-auto"
                    >
                      Size Guide
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-mid bg-white p-8">
                <h2 className="mb-6 font-serif text-2xl font-bold text-brown">
                  Join the Waiting List
                </h2>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Contact info */}
                  <div>
                    <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted">
                      Your Contact Info
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-brown">
                          Full Name <span className="text-tan">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={form.name}
                          onChange={(e) => update("name", e.target.value)}
                          placeholder="Jane Smith"
                          className="w-full rounded-lg border border-mid px-4 py-2.5 text-sm text-brown placeholder-muted focus:border-tan focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-brown">
                          Phone <span className="text-tan">*</span>
                        </label>
                        <input
                          type="tel"
                          required
                          value={form.phone}
                          onChange={(e) => update("phone", e.target.value)}
                          placeholder="(865) 426-0000"
                          className="w-full rounded-lg border border-mid px-4 py-2.5 text-sm text-brown placeholder-muted focus:border-tan focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="mb-1.5 block text-sm font-medium text-brown">
                        Email <span className="text-tan">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={form.email}
                        onChange={(e) => update("email", e.target.value)}
                        placeholder="jane@example.com"
                        className="w-full rounded-lg border border-mid px-4 py-2.5 text-sm text-brown placeholder-muted focus:border-tan focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Unit preference */}
                  <div>
                    <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted">
                      Unit Preference
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-brown">
                          Preferred Size <span className="text-tan">*</span>
                        </label>
                        <select
                          required
                          value={form.preferredSize}
                          onChange={(e) =>
                            update("preferredSize", e.target.value)
                          }
                          className="w-full rounded-lg border border-mid px-4 py-2.5 text-sm text-brown focus:border-tan focus:outline-none"
                        >
                          <option value="">Select a size…</option>
                          {SIZES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-brown">
                          Unit Type
                        </label>
                        <select
                          value={form.preferredType}
                          onChange={(e) =>
                            update("preferredType", e.target.value)
                          }
                          className="w-full rounded-lg border border-mid px-4 py-2.5 text-sm text-brown focus:border-tan focus:outline-none"
                        >
                          <option value="">No preference</option>
                          {TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="mb-1.5 block text-sm font-medium text-brown">
                        Desired Move-In Date
                      </label>
                      <input
                        type="date"
                        value={form.desiredMoveInDate}
                        onChange={(e) =>
                          update("desiredMoveInDate", e.target.value)
                        }
                        min={new Date().toISOString().split("T")[0]}
                        className="w-full rounded-lg border border-mid px-4 py-2.5 text-sm text-brown focus:border-tan focus:outline-none"
                      />
                    </div>
                    <div className="mt-4">
                      <label className="mb-1.5 block text-sm font-medium text-brown">
                        Additional Notes
                      </label>
                      <textarea
                        rows={3}
                        value={form.notes}
                        onChange={(e) => update("notes", e.target.value)}
                        placeholder="Any special requirements, vehicle dimensions, etc."
                        className="w-full rounded-lg border border-mid px-4 py-2.5 text-sm text-brown placeholder-muted focus:border-tan focus:outline-none resize-none"
                      />
                    </div>
                  </div>

                  {/* SMS opt-in */}
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-mid p-4 hover:border-tan transition-colors">
                    <div className="relative mt-0.5 flex-shrink-0">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={form.smsOptIn}
                        onChange={(e) => update("smsOptIn", e.target.checked)}
                      />
                      <div
                        className={`h-5 w-5 rounded border-2 transition-colors ${
                          form.smsOptIn
                            ? "border-tan bg-tan"
                            : "border-mid bg-white"
                        }`}
                      >
                        {form.smsOptIn && (
                          <svg
                            className="h-4 w-4 text-brown"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={3}
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M4.5 12.75l6 6 9-13.5"
                            />
                          </svg>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-brown">
                        Text me when a unit is available
                      </p>
                      <p className="text-xs text-muted">
                        Msg & data rates may apply. Reply STOP to unsubscribe.
                      </p>
                    </div>
                  </label>

                  <button
                    type="submit"
                    disabled={state === "submitting"}
                    className="w-full rounded-lg bg-tan py-3 font-semibold text-brown hover:bg-tan-light transition-colors disabled:opacity-60"
                  >
                    {state === "submitting"
                      ? "Submitting…"
                      : "Join the Waiting List"}
                  </button>

                  <p className="text-center text-xs text-muted">
                    By submitting, you agree to our{" "}
                    <Link href="/privacy" className="text-tan hover:underline">
                      Privacy Policy
                    </Link>
                    . No commitment required.
                  </p>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
