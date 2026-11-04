import { useAtomMount, useAtomValue } from "@effect/atom-react";
import {
  scopedProjectKey,
  scopeProjectRef,
  scopeThreadRef,
} from "@t3tools/client-runtime/environment";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import {
  AuthTerminalOperateScope,
  type DeviceSummary,
  type DiscoveredLocalServer,
  type EnvironmentId,
  type ProjectScript,
  type ThreadId,
} from "@t3tools/contracts";
import { resolveProjectScripts } from "@t3tools/shared/projectScripts";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useEffectEvent, useState } from "react";

import { isElectron } from "~/env";
import { useEnvironmentSettings } from "~/hooks/useSettings";
import { useLocalStorage } from "~/hooks/useLocalStorage";
import { usePendingProjectScriptLaunchStore } from "~/pendingProjectScriptLaunchStore";
import { useDiscoveredPortsState } from "~/portDiscoveryState";
import {
  deviceEnvironment,
  deviceHostProbeAtom,
  NO_DEVICE_PROBE_ATOM,
  useDeviceState,
} from "~/state/device";
import { useProjects, useThreadShells } from "~/state/entities";
import { useEnvironment, useEnvironments } from "~/state/environments";
import { previewEnvironment } from "~/state/preview";
import { useEnvironmentScope } from "~/state/session";
import { useAtomCommand } from "~/state/use-atom-command";
import { buildThreadRouteParams } from "../../threadRoutes";
import { SidebarInset } from "../ui/sidebar";
import { stackedThreadToast, toastManager } from "../ui/toast";
import { WorkspaceBreadcrumb, WorkspaceBreadcrumbItem } from "../WorkspaceBreadcrumb";
import { WorkspacePageContainer } from "../WorkspacePageContainer";
import { WorkspacePageHeader } from "../WorkspacePageHeader";
import {
  bootedMachineDevices,
  DEV_SERVERS_START_THREAD_BY_PROJECT_KEY,
  DevServersStartThreadByProjectSchema,
  groupOwnedServers,
  resolveStartTargetThread,
  sortScriptsForStart,
} from "./devServers.logic";
import {
  DevServersEmptyState,
  DevServersSectionBody,
  devServersDeviceKey,
  sectionHasRunning,
  type DevServersEnvironmentSection,
  type StartProjectSection,
} from "./DevServersView";

export function DevServersPage() {
  const { environments } = useEnvironments();
  const loaded = environments.filter((environment) => environment.serverConfig !== null);
  const [startThreadByProject, setStartThreadByProject] = useLocalStorage(
    DEV_SERVERS_START_THREAD_BY_PROJECT_KEY,
    {},
    DevServersStartThreadByProjectSchema,
  );
  const [runningEnvironmentIds, setRunningEnvironmentIds] = useState<ReadonlySet<EnvironmentId>>(
    () => new Set(),
  );

  const reportRunning = (environmentId: EnvironmentId, running: boolean) =>
    setRunningEnvironmentIds((current) => {
      if (current.has(environmentId) === running) return current;
      const next = new Set(current);
      if (running) next.add(environmentId);
      else next.delete(environmentId);
      return next;
    });

  const rememberStartThread = (projectKey: string, threadId: ThreadId) =>
    setStartThreadByProject((current) => ({ ...current, [projectKey]: threadId }));

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden bg-background">
        <WorkspacePageHeader electron={isElectron} className="relative bg-background">
          <WorkspaceBreadcrumb ariaLabel="Dev servers breadcrumb">
            <WorkspaceBreadcrumbItem current>
              <h1 className="truncate">Dev servers</h1>
            </WorkspaceBreadcrumbItem>
          </WorkspaceBreadcrumb>
        </WorkspacePageHeader>
        <div className="topbar-scroll-fade scrollbar-gutter-both min-h-0 flex-1 overflow-y-auto">
          <WorkspacePageContainer width="expanded" className="min-h-full gap-8">
            {runningEnvironmentIds.size === 0 ? <DevServersEmptyState /> : null}
            {loaded.map((environment) => (
              <DevServersEnvironment
                key={environment.environmentId}
                environmentId={environment.environmentId}
                label={environment.label}
                showLabel={loaded.length > 1}
                startThreadByProject={startThreadByProject}
                onRememberStartThread={rememberStartThread}
                onRunningChange={reportRunning}
              />
            ))}
          </WorkspacePageContainer>
        </div>
      </div>
    </SidebarInset>
  );
}

function reportFailure(title: string, error: unknown) {
  toastManager.add(
    stackedThreadToast({
      type: "error",
      title,
      description: error instanceof Error ? error.message : String(error),
    }),
  );
}

function DevServersEnvironment(props: {
  readonly environmentId: EnvironmentId;
  readonly label: string;
  readonly showLabel: boolean;
  readonly startThreadByProject: Readonly<Record<string, string>>;
  readonly onRememberStartThread: (projectKey: string, threadId: ThreadId) => void;
  readonly onRunningChange: (environmentId: EnvironmentId, running: boolean) => void;
}) {
  const { environmentId } = props;
  const navigate = useNavigate();
  const { servers } = useDiscoveredPortsState(environmentId);
  const { state: deviceState, loaded: deviceStateLoaded } = useDeviceState(environmentId);
  useAtomMount(
    deviceStateLoaded && deviceState.hostStatus !== "disabled"
      ? deviceHostProbeAtom(environmentId)
      : NO_DEVICE_PROBE_ATOM,
  );
  const projects = useProjects().filter((project) => project.environmentId === environmentId);
  const threadShells = useThreadShells().filter((thread) => thread.environmentId === environmentId);
  const settings = useEnvironmentSettings(environmentId);
  const canStopServers = useAtomValue(
    previewEnvironment.stopLocalServer.permissionAtom(environmentId),
  );
  const supportsStop =
    useEnvironment(environmentId)?.serverConfig?.environment.capabilities.localServerStop === true;
  const canShutdown = useAtomValue(deviceEnvironment.shutdown.permissionAtom(environmentId));
  const canStart = useEnvironmentScope(environmentId, AuthTerminalOperateScope);
  const stopServer = useAtomCommand(previewEnvironment.stopLocalServer, {
    label: "dev servers stop",
  });
  const shutdownDevice = useAtomCommand(deviceEnvironment.shutdown);
  const [busyKeys, setBusyKeys] = useState<ReadonlySet<string>>(() => new Set());

  const serverGroups = groupOwnedServers({ environmentId, servers, threadShells, projects });
  const startProjects = projects.flatMap((project): ReadonlyArray<StartProjectSection> => {
    const scripts = sortScriptsForStart(resolveProjectScripts(settings, project));
    if (scripts.length === 0) return [];
    const key = scopedProjectKey(scopeProjectRef(environmentId, project.id));
    const threads = threadShells
      .filter((thread) => thread.projectId === project.id && thread.archivedAt === null)
      .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    const remembered = threads.find((thread) => thread.id === props.startThreadByProject[key]);
    const target = resolveStartTargetThread({
      threads,
      rememberedThreadId: remembered?.id ?? null,
    });
    return [
      {
        key,
        environmentId,
        projectId: project.id,
        projectName: project.title,
        scripts,
        threads: threads.map((thread) => ({
          threadId: thread.id,
          title: thread.title,
          worktreePath: thread.worktreePath,
        })),
        targetThreadId: target?.id ?? null,
      },
    ];
  });
  const section: DevServersEnvironmentSection = {
    environmentId,
    label: props.label,
    serverGroups,
    devices: bootedMachineDevices(deviceState),
    hostLabelById: new Map(deviceState.hosts.map((host) => [host.id, host.label])),
    canStop: canStopServers && supportsStop,
    canShutdown,
    canStart,
    projects: startProjects,
  };
  const running = sectionHasRunning(section);

  const reportRunning = useEffectEvent((value: boolean) =>
    props.onRunningChange(environmentId, value),
  );
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- each environment's hooks live in this child, so the page learns whether anything runs here to decide on the shared empty state
  useEffect(() => {
    reportRunning(running);
    return () => reportRunning(false);
  }, [running]);

  const runBusy = async <T,>(key: string, action: () => Promise<T>) => {
    setBusyKeys((current) => new Set(current).add(key));
    try {
      return await action();
    } finally {
      setBusyKeys((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  };

  const stop = async (server: DiscoveredLocalServer) => {
    const { pid } = server;
    const row = serverGroups
      .flatMap((group) => group.rows)
      .find((entry) => entry.server === server);
    if (pid === null || !row || busyKeys.has(row.key)) return;
    const result = await runBusy(row.key, () =>
      stopServer({ environmentId, input: { pid, port: server.port } }),
    );
    if (result._tag === "Failure" && !isAtomCommandInterrupted(result)) {
      reportFailure("Could not stop server", squashAtomCommandFailure(result));
    }
  };

  const shutdown = async (device: DeviceSummary) => {
    const key = devServersDeviceKey(environmentId, device);
    if (busyKeys.has(key)) return;
    const result = await runBusy(key, () =>
      shutdownDevice({
        environmentId,
        input: { hostId: device.hostId, deviceId: device.id, platform: device.platform },
      }),
    );
    if (result._tag === "Failure" && !isAtomCommandInterrupted(result)) {
      reportFailure("Could not shut down device", squashAtomCommandFailure(result));
    }
  };

  const start = (project: StartProjectSection, script: ProjectScript, threadId: ThreadId) => {
    const threadRef = scopeThreadRef(project.environmentId, threadId);
    props.onRememberStartThread(project.key, threadId);
    usePendingProjectScriptLaunchStore.getState().request({ threadRef, scriptId: script.id });
    void navigate({ to: "/$environmentId/$threadId", params: buildThreadRouteParams(threadRef) });
  };

  return (
    <DevServersSectionBody
      section={section}
      showLabel={props.showLabel}
      busyKeys={busyKeys}
      onStopServer={(_, server) => void stop(server)}
      onShutdownDevice={(_, device) => void shutdown(device)}
      onStartScript={start}
      onSelectStartThread={(project, threadId) =>
        props.onRememberStartThread(project.key, threadId)
      }
    />
  );
}
