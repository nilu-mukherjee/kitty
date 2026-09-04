"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startOrder = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/session", { method: "POST" });
      if (!res.ok) throw new Error("Could not start a new Kitty");
      const data = await res.json();
      router.push(`/order/${data.id}?host=${data.hostToken}`);
    } catch {
      setError("Something went wrong starting your Kitty. Try again.");
      setLoading(false);
    }
  };

  return (
    <main className="wrap">
      <wa-card suppressHydrationWarning appearance="outlined" orientation="vertical">
        <h1><wa-icon suppressHydrationWarning name="paw"></wa-icon> Kitty</h1>
        <p>
          Start a group order. Everyone&apos;s own AI agent can add their items and allergies
          straight into the shared cart — Kitty splits the bill automatically.
        </p>
        <p style={{ color: "var(--wa-color-text-quiet)", fontSize: "var(--wa-font-size-s)" }}>
          Built for the WebMCP challenge using the WebAwesome design system.
        </p>
        <div className="home-actions">
          <wa-button suppressHydrationWarning className="start-kitty-btn" variant="brand" appearance="filled" loading={loading} disabled={loading} onClick={startOrder}>
            <wa-icon suppressHydrationWarning canvas="fixed" slot="start" name="cart-shopping"></wa-icon>
            <span>{loading ? "Starting…" : "Start a Kitty"}</span>
          </wa-button>
        </div>
        {error && (
          <wa-callout suppressHydrationWarning variant="danger" style={{ marginTop: "var(--wa-space-s)" }}>
            <wa-icon suppressHydrationWarning canvas="fixed" slot="icon" name="triangle-exclamation"></wa-icon>
            <span>{error}</span>
          </wa-callout>
        )}
      </wa-card>
    </main>
  );
}
