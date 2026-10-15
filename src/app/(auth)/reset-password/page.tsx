import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { ResetPasswordForm } from "@/components/organisms/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
