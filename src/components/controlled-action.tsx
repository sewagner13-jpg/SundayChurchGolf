"use client";

import { useCallback, useState } from "react";

export type ControlledActionState =
  | { status: "idle"; message: "" }
  | { status: "pending"; message: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export async function runControlledAction<T>(
  action: () => Promise<T>,
  onStateChange: (state: ControlledActionState) => void
): Promise<T | null> {
  onStateChange({ status: "pending", message: "Working..." });
  try {
    const result = await action();
    const message =
      result &&
      typeof result === "object" &&
      "message" in result &&
      typeof result.message === "string"
        ? result.message
        : "Saved.";
    onStateChange({ status: "success", message });
    return result;
  } catch (error) {
    onStateChange({
      status: "error",
      message: error instanceof Error ? error.message : "The action could not be completed.",
    });
    return null;
  }
}

export function useControlledAction() {
  const [state, setState] = useState<ControlledActionState>({
    status: "idle",
    message: "",
  });
  const execute = useCallback(
    <T,>(action: () => Promise<T>) => runControlledAction(action, setState),
    []
  );
  const reset = useCallback(
    () => setState({ status: "idle", message: "" }),
    []
  );
  return { state, execute, reset, pending: state.status === "pending" };
}

export function ControlledActionFeedback({ state }: { state: ControlledActionState }) {
  if (state.status === "idle") return null;
  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={`text-sm ${
        state.status === "error"
          ? "text-red-700"
          : state.status === "success"
            ? "text-green-700"
            : "text-gray-600"
      }`}
    >
      {state.message}
    </p>
  );
}
