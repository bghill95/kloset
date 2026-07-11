import { redirect } from "next/navigation";
import PasscodeForm from "@/components/PasscodeForm";
import { getSetting } from "@/lib/db/settings";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!(await getSetting("passcodeHash"))) redirect("/setup");
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
      <h1 className="font-script text-6xl text-pink">Kloset</h1>
      <p className="text-mute">Your virtual closet</p>
      <PasscodeForm endpoint="/api/auth/login" buttonLabel="Unlock" />
    </div>
  );
}
