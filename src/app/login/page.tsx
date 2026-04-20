import { GoogleSignInButton } from "./google-button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = params.next ?? "/dashboard";
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-6 py-12">
      <h1
        className="mb-2 text-4xl leading-none"
        style={{ fontFamily: "var(--font-boldonse), ui-sans-serif" }}
      >
        SIGN IN
      </h1>
      <p className="mb-10 text-sm text-[color:var(--fg-muted)]">
        One tap with your Google account. No passwords, no waiting for emails.
      </p>
      <GoogleSignInButton next={next} />
    </main>
  );
}
