import { submitInviteCode } from "./actions";
import { JoinForm } from "./join-form";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-6 py-12">
      <h1
        className="mb-2 text-4xl leading-none"
        style={{ fontFamily: "var(--font-boldonse), ui-sans-serif" }}
      >
        F1 FANTASY
      </h1>
      <p className="mb-10 text-sm text-[color:var(--fg-muted)]">
        Private prediction league. Enter the invite code to continue.
      </p>
      <JoinForm action={submitInviteCode} next={params.next ?? "/dashboard"} />
    </main>
  );
}
