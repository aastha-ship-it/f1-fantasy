import { redirect } from "next/navigation";

export default function RootPage() {
  // Middleware handles the gate; redirect here to normalize the entry point.
  redirect("/dashboard");
}
