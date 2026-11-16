import { ProjectId, ProviderInstanceId, ThreadId, type ModelSelection } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { DraftId, useComposerDraftStore } from "../../composerDraftStore";

import {
  composerDraftHasNonTextContent,
  composerScheduledTaskPrefill,
  composerSendLaterState,
  scheduledTaskTitleFromPrompt,
} from "./composerSendLater.logic";

const modelSelection: ModelSelection = {
  instanceId: ProviderInstanceId.make("claude"),
  model: "claude-opus",
  options: [{ id: "effort", value: "high" }],
};

const base = {
  prompt: "Tidy the notes\nand push",
  projectId: ProjectId.make("project-1"),
  modelSelection,
  runtimeMode: "full-access",
  threadId: null,
  draft: null,
} as const;

describe("scheduledTaskTitleFromPrompt", () => {
  it("uses the first non-empty line, trimmed", () => {
    expect(scheduledTaskTitleFromPrompt("\n\n  Tidy notes  \nmore")).toBe("Tidy notes");
  });

  it("cuts a long first line to 80 characters", () => {
    const title = scheduledTaskTitleFromPrompt(`${"word ".repeat(100)}\nsecond`);
    expect(title.length).toBeLessThanOrEqual(80);
    expect(title.endsWith("…")).toBe(true);
    expect(title).toBe(title.trim());
  });

  it("returns an empty title for a blank prompt", () => {
    expect(scheduledTaskTitleFromPrompt("  \n ")).toBe("");
  });
});

describe("composerScheduledTaskPrefill", () => {
  it("carries the prompt, project, model and modes as a one-time task", () => {
    expect(composerScheduledTaskPrefill(base)).toEqual({
      title: "Tidy the notes",
      prompt: "Tidy the notes\nand push",
      scheduleMode: "once",
      projectId: "project-1",
      threadMode: "new_thread",
      modelKey: "claude:claude-opus",
      baseModelSelection: modelSelection,
      runtimeMode: "full-access",
    });
  });

  it("leaves the interaction mode to the form, since the composer does not pick one", () => {
    expect(composerScheduledTaskPrefill(base)).not.toHaveProperty("interactionMode");
  });

  it("maps a draft that creates a worktree, keeping its base branch", () => {
    const prefill = composerScheduledTaskPrefill({
      ...base,
      draft: { envMode: "worktree", worktreePath: null, branch: "develop", startFromOrigin: true },
    });
    expect(prefill).toMatchObject({
      workspaceMode: "worktree",
      baseRef: "develop",
      startFromOrigin: true,
      threadMode: "new_thread",
    });
    expect(prefill).not.toHaveProperty("threadId");
  });

  it("leaves the base branch to the form default when the draft has none", () => {
    const prefill = composerScheduledTaskPrefill({
      ...base,
      draft: { envMode: "worktree", worktreePath: null, branch: null, startFromOrigin: false },
    });
    expect(prefill).toMatchObject({ workspaceMode: "worktree", startFromOrigin: false });
    expect(prefill).not.toHaveProperty("baseRef");
  });

  it("maps a draft bound to an existing checkout", () => {
    expect(
      composerScheduledTaskPrefill({
        ...base,
        draft: {
          envMode: "worktree",
          worktreePath: "/w/x",
          branch: "develop",
          startFromOrigin: false,
        },
      }),
    ).toMatchObject({ workspaceMode: "existing_worktree", existingWorktreePath: "/w/x" });
  });

  it("maps a local draft to the project checkout", () => {
    expect(
      composerScheduledTaskPrefill({
        ...base,
        draft: { envMode: "local", worktreePath: null, branch: null, startFromOrigin: false },
      }),
    ).toMatchObject({ workspaceMode: "root" });
  });

  it("continues an existing thread and leaves its checkout alone", () => {
    const prefill = composerScheduledTaskPrefill({
      ...base,
      threadId: ThreadId.make("thread-1"),
      draft: { envMode: "worktree", worktreePath: "/w/x", branch: "b", startFromOrigin: true },
    });
    expect(prefill).toMatchObject({ threadId: "thread-1", threadMode: "continue" });
    expect(prefill).not.toHaveProperty("workspaceMode");
    expect(prefill).not.toHaveProperty("existingWorktreePath");
  });
});

describe("composerDraftHasNonTextContent", () => {
  const target = DraftId.make("send-later-content");
  useComposerDraftStore.getState().setPrompt(target, "Tidy the notes");
  const draft = useComposerDraftStore.getState().getComposerDraft(target)!;

  it("ignores the prompt text itself", () => {
    expect(composerDraftHasNonTextContent(draft)).toBe(false);
    expect(composerDraftHasNonTextContent(null)).toBe(false);
  });

  it("counts a reply, which a scheduled task cannot carry", () => {
    expect(
      composerDraftHasNonTextContent({
        ...draft,
        replyTo: {} as unknown as NonNullable<typeof draft.replyTo>,
      }),
    ).toBe(true);
  });
});

describe("composerSendLaterState", () => {
  const ready = {
    hidden: false,
    promptHasText: true,
    hasNonTextContent: false,
    canSchedule: true,
    environmentAvailable: true,
    dictating: false,
  };

  it("is enabled for a text prompt the user may schedule", () => {
    expect(composerSendLaterState(ready)).toEqual({ kind: "enabled" });
  });

  it("stays hidden whatever else is true", () => {
    expect(composerSendLaterState({ ...ready, hidden: true, promptHasText: false })).toEqual({
      kind: "hidden",
    });
  });

  it.each([
    [{ environmentAvailable: false, canSchedule: false }, "Environment disconnected"],
    [{ canSchedule: false, dictating: true }, "You can't schedule tasks here"],
    [{ dictating: true, hasNonTextContent: true }, "Finish dictation first"],
    [{ hasNonTextContent: true, promptHasText: false }, "Scheduled tasks are text only"],
    [{ promptHasText: false }, "Type a prompt to schedule"],
  ])("gives the first blocking reason for %o", (overrides, reason) => {
    expect(composerSendLaterState({ ...ready, ...overrides })).toEqual({
      kind: "disabled",
      reason,
    });
  });
});
