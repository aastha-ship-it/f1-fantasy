"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { RevealEventResult } from "@/lib/revealEvent";

export function RevealButton({
  eventId,
  action,
}: {
  eventId: string;
  action: (input: { eventId: string }) => Promise<RevealEventResult>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    setError(null);
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Reveal this event to the whole group? Everyone's picks will open simultaneously.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await action({ eventId });
      if (res.ok) {
        router.refresh();
        router.push(`/reveal/${eventId}`);
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="rounded bg-[color:var(--accent)] px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-[color:var(--accent-hover)] disabled:opacity-40"
      >
        {pending ? "Revealing…" : "Reveal to group"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-[color:var(--error)]">
          {error}
        </p>
      )}
    </div>
  );
}
