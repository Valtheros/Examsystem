"use client";

import { useActionState } from "react";
import { Mail } from "lucide-react";
import { sendTestEmailAction } from "@/actions/admin";
import { initialActionState } from "@/actions/types";
import { ActionMessage } from "@/components/action-message";
import { SubmitButton } from "@/components/submit-button";

export function TestEmailForm({ configured }: { configured: boolean }) {
  const [state, action] = useActionState(sendTestEmailAction, initialActionState);
  return <form action={action} className="space-y-3">
    <ActionMessage state={state} />
    <SubmitButton disabled={!configured} pendingText="กำลังส่งอีเมลทดสอบ..."><Mail aria-hidden="true" className="size-4" /> ส่งเมลทดสอบ</SubmitButton>
  </form>;
}
