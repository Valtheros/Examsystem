"use client";

import { useActionState, type ReactNode } from "react";
import { initialActionState, type ActionState } from "@/actions/types";
import { ActionMessage } from "@/components/action-message";

export function WorkflowForm({ action, children, className = "space-y-3" }: {
  action: (previous: ActionState, data: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
}) {
  const [state, dispatch] = useActionState(action, initialActionState);
  return <form action={dispatch} className={className}><ActionMessage state={state} />{children}</form>;
}
