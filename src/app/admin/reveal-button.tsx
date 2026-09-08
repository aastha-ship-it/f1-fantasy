"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { RevealEventResult } from "@/lib/revealEvent";
import { MobButton } from "@/components/MobilePrimitives";

/**
 * `variant` exists because the 390pt admin fork (design_handoff_mobile §6.3)
 * needs this same one-tap reveal inside a stack of `MobButton`s: the desktop
 * pill is `rounded`, 44 tall and right-aligned, all three of which the mobile
 * design system forbids (no radius anywhere, one full-width 52px accent CTA
 * per screen). Duplicating the confirm + `useTransition` into a second client
 * component to restyle it would be two places to regress. `"default"` is
 * byte-for-byte the pre-fork render; `"mobile-quiet"` is the same control
 * demoted to surface tone below the head of the admin action queue.
 */
export function RevealButton({
  eventId,
  action,
  variant = "default",
}: {
  eventId: string;
  action: (input: { eventId: string }) => Promise<RevealEventResult>;
  variant?: "default" | "mobile" | "mobile-quiet";
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

  const label = pending ? "Revealing…" : "Reveal to group";

  if (variant !== "default") {
    // `mobile-quiet` is the same control below the head of the admin action
    // queue — surface-toned and 46 tall, so a screen with nine pending
    // rounds carries one accent fill, not nine (see admin-mobile.tsx).
    const quiet = variant === "mobile-quiet";
    return (
      <div className="flex w-full flex-col gap-1">
        <MobButton
          onClick={onClick}
          disabled={pending}
          tone={quiet ? "surface" : "accent"}
          size={quiet ? "paired" : "full"}
        >
          {label}
        </MobButton>
        {error && (
          <p role="alert" className="text-xs text-[color:var(--error)]">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-end gap-1 md:w-auto">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="min-h-[44px] w-full rounded bg-[color:var(--accent)] px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-[color:var(--accent-hover)] disabled:opacity-40 md:min-h-auto md:w-auto"
      >
        {label}
      </button>
      {error && (
        <p role="alert" className="text-xs text-[color:var(--error)]">
          {error}
        </p>
      )}
    </div>
  );
}
