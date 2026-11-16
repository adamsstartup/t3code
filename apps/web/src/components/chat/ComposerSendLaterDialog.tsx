import type { ScheduledTask } from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";

import { ScheduledTaskEditorDialog } from "../settings/ScheduledTasksSettings";
import { SettingsScopeProvider } from "../settings/SettingsScopeContext";
import { scheduleLabel } from "../settings/scheduledTasksSettings.logic";
import type { SettingsScopeSearch } from "../settings/settingsScope";
import { toastManager } from "../ui/toast";
import {
  closeComposerSendLater,
  completeComposerSendLater,
  type ComposerSendLaterRequest,
} from "./composerSendLaterRequest";

// The editor lists projects through the settings scope; outside Settings that is every environment.
const EVERY_ENVIRONMENT: SettingsScopeSearch = {};
const ignoreScopeChange = () => {};

/** The scheduled task editor, opened from a composer with its contents filled in. */
export function ComposerSendLaterDialog({
  request,
}: {
  readonly request: ComposerSendLaterRequest;
}) {
  const navigate = useNavigate();
  const announce = (task: ScheduledTask) => {
    completeComposerSendLater();
    toastManager.add({
      type: "success",
      title: "Scheduled",
      description: `${task.title} · ${scheduleLabel(task.schedule)}`,
      actionProps: {
        children: "View task",
        onClick: () =>
          void navigate({
            to: "/settings/scheduled-tasks",
            search: { environmentId: request.environmentId, taskId: task.id },
          }),
      },
    });
  };
  return (
    <SettingsScopeProvider search={EVERY_ENVIRONMENT} onChange={ignoreScopeChange}>
      <ScheduledTaskEditorDialog
        initialEnvironmentId={request.environmentId}
        task={null}
        prefill={request.prefill}
        onSaved={announce}
        onClose={closeComposerSendLater}
      />
    </SettingsScopeProvider>
  );
}
