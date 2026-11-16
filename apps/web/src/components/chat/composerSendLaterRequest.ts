import type { EnvironmentId } from "@t3tools/contracts";
import { create } from "zustand";

import { type ComposerThreadTarget, useComposerDraftStore } from "../../composerDraftStore";
import type { ScheduledTaskPrefill } from "../settings/scheduledTasksSettings.logic";

/**
 * A composer's request to schedule its prompt. It names the draft it came from, because the
 * composer stays mounted while the user moves to another thread with the dialog open.
 */
export interface ComposerSendLaterRequest {
  readonly environmentId: EnvironmentId;
  readonly target: ComposerThreadTarget;
  readonly prefill: ScheduledTaskPrefill;
  /** Runs after the draft is cleared, so the composer can reset an editor still showing it. */
  readonly onScheduled: () => void;
}

export const useComposerSendLaterRequest = create<{ request: ComposerSendLaterRequest | null }>(
  () => ({ request: null }),
);

export function openComposerSendLater(request: ComposerSendLaterRequest): void {
  useComposerSendLaterRequest.setState({ request });
}

export function closeComposerSendLater(): void {
  useComposerSendLaterRequest.setState({ request: null });
}

/** The task was saved, so the draft it came from lets go of the prompt as a send would. */
export function completeComposerSendLater(): void {
  const request = useComposerSendLaterRequest.getState().request;
  if (request === null) return;
  useComposerDraftStore.getState().clearComposerContent(request.target);
  request.onScheduled();
}
