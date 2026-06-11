import { redirect } from "next/navigation";
import PasscodeForm from "@/components/PasscodeForm";
import { getSetting } from "@/lib/db/settings";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await getSetting("passcodeHash")) redirect("/login");
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Welcome 👋</h1>
      <p className="text-neutral-500">Create a passcode to protect your closet.</p>
      <PasscodeForm endpoint="/api/auth/setup" buttonLabel="Create passcode" confirm />
    </div>
  );
}
