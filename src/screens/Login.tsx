import { useState } from "react";
import { KeyRound, Lock, Mail } from "lucide-react";
import { useAuth } from "../auth";
import { Alert, Button, Field } from "../ui";

export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4 py-10">
      <div className="w-full rounded-3xl border border-surface-200 bg-white p-8 shadow-card">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-brand-600 text-white shadow-soft">
            <KeyRound className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-extrabold text-surface-800">تسجيل الدخول</h1>
          <p className="mt-1 text-sm text-surface-500">نسخة Full Stack من Axogram Pro</p>
        </div>

        <div className="space-y-4">
          <Field
            label="البريد الإلكتروني"
            value={email}
            onChange={setEmail}
            type="email"
            placeholder="name@example.com"
            icon={<Mail className="h-4 w-4" />}
          />
          <Field label="كلمة المرور" value={password} onChange={setPassword} type="password" placeholder="••••••••" icon={<Lock className="h-4 w-4" />} />
          {error && <Alert tone="danger" title="فشل تسجيل الدخول">{error}</Alert>}
          <Button
            variant="primary"
            className="w-full"
            disabled={loading || !email.includes("@") || !password}
            onClick={submit}
          >
            {loading ? "جاري الدخول..." : "دخول"}
          </Button>
          <div className="rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 text-xs text-surface-500">
            الدخول بالبريد الإلكتروني المسجّل لدى الإدارة. حساب الإدارة الافتراضي:{" "}
            <span className="font-bold text-surface-700">haidaralkarar20@gmail.com</span>
          </div>
        </div>
      </div>
    </div>
  );
}
