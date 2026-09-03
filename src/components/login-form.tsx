"use client";

import { LoaderCircle, LockKeyhole, PrinterCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const result = await authClient.signIn.username({
      username: String(data.get("username") ?? ""),
      password: String(data.get("password") ?? ""),
      rememberMe: true,
    });
    setPending(false);
    if (result.error) {
      setError(result.error.message || "Username หรือรหัสผ่านไม่ถูกต้อง");
      return;
    }
    router.replace(nextPath);
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md border-primary/10 shadow-2xl shadow-primary/10">
      <CardHeader className="space-y-4 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground">
          <PrinterCheck className="size-7" />
        </div>
        <div>
          <CardTitle className="text-2xl">เข้าสู่ระบบ</CardTitle>
          <CardDescription className="mt-2">ระบบจัดพิมพ์ข้อสอบ คณะวิทยาศาสตร์</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input id="username" name="username" autoComplete="username" required autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">รหัสผ่าน</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <Button className="w-full" size="lg" disabled={pending}>
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />}
            {pending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </Button>
          <p className="text-center text-xs leading-5 text-muted-foreground">
            ไม่มีการสมัครสมาชิกด้วยตนเอง หากยังไม่มีบัญชีให้ติดต่อผู้ดูแลระบบ
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
