"use client";

import { useRef, useState } from "react";

// FSD §4.9 — enquiry form. Client-side validation mirrors the server rules;
// anti-spam is a honeypot field plus a minimum time-on-page check.
const MIN_TIME_ON_PAGE_MS = 3000;

const PHONE_RE = /^[6-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function EnquiryForm({ tripId, tripName }: { tripId: string; tripName: string }) {
  const mountedAt = useRef(Date.now());
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = "Please enter your name (min 2 characters)";
    if (!PHONE_RE.test(phone.trim()))
      next.phone = "Enter a valid 10-digit Indian mobile number";
    if (!EMAIL_RE.test(email.trim())) next.email = "Enter a valid email address";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    // Bot heuristics: instant submits and filled honeypots are dropped
    // client-side; the server independently checks the honeypot too.
    if (Date.now() - mountedAt.current < MIN_TIME_ON_PAGE_MS || honeypot) {
      setState("success");
      return;
    }

    setState("submitting");
    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId,
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          website: honeypot,
        }),
      });
      if (res.status === 201) {
        setState("success");
      } else if (res.status === 422) {
        const data = await res.json();
        setErrors(data.fields ?? {});
        setState("idle");
      } else {
        setState("error");
      }
    } catch {
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="text-2xl" aria-hidden>
          ✅
        </p>
        <h3 className="mt-2 font-semibold text-emerald-900">Enquiry received!</h3>
        <p className="mt-1 text-sm text-emerald-800">
          Thanks for your interest in {tripName}. We&apos;ll get back to you shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <h3 className="text-lg font-semibold text-stone-900">Enquire about this trek</h3>

      {/* Honeypot: hidden from real users, tempting for bots */}
      <div className="absolute -left-[9999px] top-auto" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="enq-name" className="block text-sm font-medium text-stone-700">
          Name
        </label>
        <input
          id="enq-name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-forest-500 focus:outline-none focus:ring-1 focus:ring-forest-500"
        />
        {errors.name && <p className="mt-1 text-sm text-rose-600">{errors.name}</p>}
      </div>

      <div>
        <label htmlFor="enq-phone" className="block text-sm font-medium text-stone-700">
          Mobile number
        </label>
        <input
          id="enq-phone"
          type="tel"
          inputMode="numeric"
          placeholder="10-digit mobile number"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-forest-500 focus:outline-none focus:ring-1 focus:ring-forest-500"
        />
        {errors.phone && <p className="mt-1 text-sm text-rose-600">{errors.phone}</p>}
      </div>

      <div>
        <label htmlFor="enq-email" className="block text-sm font-medium text-stone-700">
          Email
        </label>
        <input
          id="enq-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-forest-500 focus:outline-none focus:ring-1 focus:ring-forest-500"
        />
        {errors.email && <p className="mt-1 text-sm text-rose-600">{errors.email}</p>}
      </div>

      {state === "error" && (
        <p className="text-sm text-rose-600">
          Something went wrong — please try again in a moment.
        </p>
      )}

      <button
        type="submit"
        disabled={state === "submitting"}
        className="w-full rounded-lg bg-forest-600 px-5 py-2.5 font-medium text-white transition hover:bg-forest-700 disabled:opacity-60"
      >
        {state === "submitting" ? "Sending…" : "Send enquiry"}
      </button>
    </form>
  );
}
