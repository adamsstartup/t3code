import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { expect, it, vi } from "vite-plus/test";

import { useComposerDraftStore } from "../../composerDraftStore";
import {
  closeComposerSendLater,
  completeComposerSendLater,
  openComposerSendLater,
  useComposerSendLaterRequest,
} from "./composerSendLaterRequest";

const environmentId = EnvironmentId.make("laptop");
const scheduled = scopeThreadRef(environmentId, ThreadId.make("thread-scheduled"));
const onScreen = scopeThreadRef(environmentId, ThreadId.make("thread-on-screen"));

it("clears the draft the task was scheduled from, not the one now on screen", () => {
  const drafts = useComposerDraftStore.getState();
  drafts.setPrompt(scheduled, "Tidy the notes");
  drafts.setPrompt(onScreen, "Half-written reply");
  const onScheduled = vi.fn();
  openComposerSendLater({
    environmentId,
    target: scheduled,
    prefill: { prompt: "Tidy the notes" },
    onScheduled,
  });

  completeComposerSendLater();

  expect(useComposerDraftStore.getState().getComposerDraft(scheduled)?.prompt ?? "").toBe("");
  expect(useComposerDraftStore.getState().getComposerDraft(onScreen)?.prompt).toBe(
    "Half-written reply",
  );
  expect(onScheduled).toHaveBeenCalledTimes(1);
  // Saving leaves the request open; the dialog closes it once it has finished.
  expect(useComposerSendLaterRequest.getState().request?.target).toBe(scheduled);
  closeComposerSendLater();
  expect(useComposerSendLaterRequest.getState().request).toBeNull();
  completeComposerSendLater();
  expect(onScheduled).toHaveBeenCalledTimes(1);
});
