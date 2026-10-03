"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { ActionState } from "@/actions/types";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ActionMessage({ state }: { state: ActionState }) {
  const previous = useRef<ActionState | null>(null);
  useEffect(() => {
    if (previous.current !== state && state.ok && state.message) toast.success(state.message);
    previous.current = state;
  }, [state]);
  if (!state.message || state.ok) return null;
  return (
    <Alert variant="destructive">
      <AlertDescription aria-live="polite">
        <p>{state.message}</p>
        {state.fieldErrors && (
          <ul className="mt-2 list-inside list-disc space-y-1">
            {[...new Set(Object.values(state.fieldErrors).flat())].map((message) => <li key={message}>{message}</li>)}
          </ul>
        )}
      </AlertDescription>
    </Alert>
  );
}
