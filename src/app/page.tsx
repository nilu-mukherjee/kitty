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
      <h1>🐱 Kitty</h1>
      <p>
        Start a group order. Everyone&apos;s own AI agent can add their items and allergies
        straight into the shared cart — Kitty splits the bill automatically.
      </p>
      <button onClick={startOrder} disabled={loading}>
        {loading ? "Starting…" : "Start a Kitty"}
      </button>
      {error && <p className="notice">{error}</p>}
    </main>
  );
}
