import type { ActionState } from "@/actions/types";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ActionMessage({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <Alert variant={state.ok ? "default" : "destructive"}>
      <AlertDescription>{state.message}</AlertDescription>
    </Alert>
  );
}
