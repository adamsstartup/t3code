import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentId, ScheduledTask } from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import { CalendarClockIcon } from "lucide-react";
import { memo, type PointerEventHandler } from "react";

import { ScheduledTaskEditorDialog } from "../settings/ScheduledTasksSettings";
import { SettingsScopeProvider } from "../settings/SettingsScopeContext";
import { scheduleLabel, type ScheduledTaskPrefill } from "../settings/scheduledTasksSettings.logic";
import type { SettingsScopeSearch } from "../settings/settingsScope";
import { serverEnvironment } from "../../state/server";
import { Button } from "../ui/button";
import { toastManager } from "../ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { composerSendLaterState } from "./composerSendLater.logic";

const keepFocus: PointerEventHandler<HTMLElement> = (event) => {
  event.preventDefault();
};

export const ComposerSendLaterButton = memo(function ComposerSendLaterButton(props: {
  readonly environmentId: EnvironmentId;
  readonly hidden: boolean;
  readonly promptHasText: boolean;
  readonly hasNonTextContent: boolean;
  readonly environmentAvailable: boolean;
  readonly dictating: boolean;
  readonly onOpen: () => void;
}) {
  const canSchedule = useAtomValue(
    serverEnvironment.upsertScheduledTask.permissionAtom(props.environmentId),
  );
  const state = composerSendLaterState({
    hidden: props.hidden,
    promptHasText: props.promptHasText,
    hasNonTextContent: props.hasNonTextContent,
    canSchedule,
    environmentAvailable: props.environmentAvailable,
    dictating: props.dictating,
  });
  if (state.kind === "hidden") return null;
  const disabledReason = state.kind === "disabled" ? state.reason : null;
  return (
    <Tooltip>
      {/* The span keeps the tooltip reachable while the button is disabled. */}
      <TooltipTrigger render={<span className="inline-flex shrink-0" />}>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="Send later"
          disabled={disabledReason !== null}
          onPointerDown={keepFocus}
          onClick={props.onOpen}
        >
          <CalendarClockIcon />
        </Button>
      </TooltipTrigger>
      <TooltipPopup>{disabledReason ?? "Send later"}</TooltipPopup>
    </Tooltip>
  );
});

// The editor lists projects through the settings scope; outside Settings that is every environment.
const EVERY_ENVIRONMENT: SettingsScopeSearch = {};
const ignoreScopeChange = () => {};

/** The scheduled task editor, opened from the composer with its contents filled in. */
export function ComposerSendLaterDialog(props: {
  readonly environmentId: EnvironmentId;
  readonly prefill: ScheduledTaskPrefill;
  /** Runs once the task is saved, so the composer can clear what it handed over. */
  readonly onScheduled: () => void;
  readonly onClose: () => void;
}) {
  const navigate = useNavigate();
  const { environmentId, onScheduled } = props;
  const announce = (task: ScheduledTask) => {
    onScheduled();
    toastManager.add({
      type: "success",
      title: "Scheduled",
      description: `${task.title} · ${scheduleLabel(task.schedule)}`,
      actionProps: {
        children: "View task",
        onClick: () =>
          void navigate({
            to: "/settings/scheduled-tasks",
            search: { environmentId, taskId: task.id },
          }),
      },
    });
  };
  return (
    <SettingsScopeProvider search={EVERY_ENVIRONMENT} onChange={ignoreScopeChange}>
      <ScheduledTaskEditorDialog
        initialEnvironmentId={environmentId}
        task={null}
        prefill={props.prefill}
        onSaved={announce}
        onClose={props.onClose}
      />
    </SettingsScopeProvider>
  );
}
