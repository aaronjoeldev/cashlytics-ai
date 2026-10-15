import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { LoginForm } from "@/components/organisms/login-form";

export default function LoginPage() {
  return (
    <Suspense fallback={<Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />}>
      <LoginForm />
    </Suspense>
  );
}
