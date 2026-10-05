"use client";

import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
    const result = await authClient.signIn.username({
      username: String(data.get("username") ?? ""),
      password: String(data.get("password") ?? ""),
      rememberMe: true,
    });
    if (result.error) {
      setError(result.error.status === 429 ? "เข้าสู่ระบบถี่เกินไป กรุณารอสักครู่แล้วลองอีกครั้ง" : result.error.status === 401 ? "Username หรือรหัสผ่านไม่ถูกต้อง" : result.error.message || "เข้าสู่ระบบไม่สำเร็จ");
      return;
    }
    router.replace(nextPath);
    router.refresh();
    } catch {
      setError("เชื่อมต่อระบบไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="w-full max-w-md">
      <LockKeyhole className="mb-5 size-7 text-primary" aria-hidden="true" />
      <h1 className="text-3xl font-semibold">เข้าสู่ระบบ</h1>
      <p className="mb-8 mt-3 text-muted-foreground">ใช้บัญชีที่ผู้ดูแลระบบสร้างให้</p>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input id="username" name="username" autoComplete="username" required autoFocus className="bg-card" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">รหัสผ่าน</Label>
            <div className="relative">
              <Input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required className="bg-card pr-12" />
              <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 text-muted-foreground" aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </Button>
            </div>
          </div>
          <Button className="w-full" size="lg" disabled={pending}>
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {pending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            {!pending ? <ArrowRight className="size-4" aria-hidden="true" /> : null}
          </Button>
          <p className="border-t pt-5 text-sm leading-6 text-muted-foreground">
            ไม่มีการสมัครสมาชิกด้วยตนเอง หากยังไม่มีบัญชีให้ติดต่อผู้ดูแลระบบ
          </p>
        </form>
    </section>
  );
}
