import { requestMagicLink } from "./actions";
import { LoginForm } from "./login-form";

export default async function LoginPage({
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
        SIGN IN
      </h1>
      <p className="mb-10 text-sm text-[color:var(--fg-muted)]">
        Enter your email — we&rsquo;ll send you a magic link.
      </p>
      <LoginForm action={requestMagicLink} next={params.next ?? "/dashboard"} />
    </main>
  );
}
