import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import { type ScopedThreadRef } from "@t3tools/contracts";
import { create } from "zustand";

export interface PendingProjectScriptLaunch {
  readonly threadRef: ScopedThreadRef;
  readonly scriptId: string;
}

interface PendingProjectScriptLaunchState {
  readonly pending: PendingProjectScriptLaunch | null;
  readonly request: (launch: PendingProjectScriptLaunch) => void;
  readonly claim: (
    threadRef: ScopedThreadRef,
    scriptIds: ReadonlyArray<string>,
  ) => PendingProjectScriptLaunch | null;
}

export const usePendingProjectScriptLaunchStore = create<PendingProjectScriptLaunchState>()(
  (set, get) => ({
    pending: null,
    request: (launch) => set({ pending: launch }),
    claim: (threadRef, scriptIds) => {
      const { pending } = get();
      if (
        pending === null ||
        scopedThreadKey(pending.threadRef) !== scopedThreadKey(threadRef) ||
        !scriptIds.includes(pending.scriptId)
      ) {
        return null;
      }
      set({ pending: null });
      return pending;
    },
  }),
);
