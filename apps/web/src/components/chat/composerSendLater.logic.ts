import type {
  ModelSelection,
  ProjectId,
  ProviderInteractionMode,
  RuntimeMode,
  ThreadId,
} from "@t3tools/contracts";

import type { DraftThreadState } from "../../composerDraftStore";
import type { ScheduledTaskPrefill } from "../settings/scheduledTasksSettings.logic";

/** Long enough to tell tasks apart in the list, short enough to stay on one row. */
const TITLE_MAX_CHARS = 80;

export function scheduledTaskTitleFromPrompt(prompt: string): string {
  const firstLine =
    prompt
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? "";
  if (firstLine.length <= TITLE_MAX_CHARS) return firstLine;
  return `${firstLine.slice(0, TITLE_MAX_CHARS - 1).trimEnd()}…`;
}

type DraftCheckout = Pick<
  DraftThreadState,
  "envMode" | "worktreePath" | "branch" | "startFromOrigin"
>;

function checkoutPrefill(draft: DraftCheckout): ScheduledTaskPrefill {
  if (draft.envMode === "local") return { workspaceMode: "root" };
  if (draft.worktreePath) {
    return { workspaceMode: "existing_worktree", existingWorktreePath: draft.worktreePath };
  }
  return {
    workspaceMode: "worktree",
    startFromOrigin: draft.startFromOrigin,
    ...(draft.branch ? { baseRef: draft.branch } : {}),
  };
}

export function composerScheduledTaskPrefill(input: {
  readonly prompt: string;
  readonly projectId: ProjectId;
  readonly modelSelection: ModelSelection;
  readonly runtimeMode: RuntimeMode;
  readonly interactionMode: ProviderInteractionMode;
  /** Set for an existing thread; null for a draft. */
  readonly threadId: ThreadId | null;
  /** The draft's checkout choice. An existing thread keeps its own checkout. */
  readonly draft: DraftCheckout | null;
}): ScheduledTaskPrefill {
  return {
    title: scheduledTaskTitleFromPrompt(input.prompt),
    prompt: input.prompt,
    scheduleMode: "once",
    projectId: input.projectId,
    modelKey: `${input.modelSelection.instanceId}:${input.modelSelection.model}`,
    baseModelSelection: input.modelSelection,
    runtimeMode: input.runtimeMode,
    interactionMode: input.interactionMode,
    ...(input.threadId !== null
      ? { threadId: input.threadId, threadMode: "continue" as const }
      : {
          threadMode: "new_thread" as const,
          ...(input.draft ? checkoutPrefill(input.draft) : {}),
        }),
  };
}

export type ComposerSendLaterState =
  | { readonly kind: "hidden" }
  | { readonly kind: "enabled" }
  | { readonly kind: "disabled"; readonly reason: string };

export function composerSendLaterState(input: {
  /** A pending question, plan follow-up, resume, or queued-message edit owns the action row. */
  readonly hidden: boolean;
  readonly promptHasText: boolean;
  /** Attachments and context chips, which a scheduled task cannot carry. */
  readonly hasNonTextContent: boolean;
  readonly canSchedule: boolean;
  readonly environmentAvailable: boolean;
  readonly dictating: boolean;
}): ComposerSendLaterState {
  if (input.hidden) return { kind: "hidden" };
  const reason = !input.environmentAvailable
    ? "Environment disconnected"
    : !input.canSchedule
      ? "You can't schedule tasks here"
      : input.dictating
        ? "Finish dictation first"
        : input.hasNonTextContent
          ? "Scheduled tasks are text only"
          : !input.promptHasText
            ? "Type a prompt to schedule"
            : null;
  return reason === null ? { kind: "enabled" } : { kind: "disabled", reason };
}
