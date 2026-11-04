import type { ServerThreadGroup } from "@t3tools/client-runtime/state/devServers";
import type {
  DeviceSummary,
  DiscoveredLocalServer,
  EnvironmentId,
  ProjectId,
  ProjectScript,
  ThreadId,
} from "@t3tools/contracts";
import { Link } from "@tanstack/react-router";
import { LoaderCircleIcon, PlayIcon, PowerIcon, ServerIcon, SquareIcon } from "lucide-react";
import type { ReactNode } from "react";

import { AndroidIcon, AppleIcon } from "../Icons";
import { Button } from "../ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../ui/empty";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

export interface StartThreadOption {
  readonly threadId: ThreadId;
  readonly title: string;
  readonly worktreePath: string | null;
}

export interface StartProjectSection {
  /** `scopedProjectKey` of the project. */
  readonly key: string;
  readonly environmentId: EnvironmentId;
  readonly projectId: ProjectId;
  readonly projectName: string;
  /** Logical project key the project settings page selects by. */
  readonly settingsProjectKey: string;
  /** Already sorted for starting. */
  readonly scripts: ReadonlyArray<ProjectScript>;
  /** Live threads, newest first. */
  readonly threads: ReadonlyArray<StartThreadOption>;
  readonly targetThreadId: ThreadId | null;
}

export interface DevServersEnvironmentSection {
  readonly environmentId: EnvironmentId;
  readonly label: string;
  /** Whether both the server and device lists have arrived. */
  readonly loaded: boolean;
  readonly serverGroups: ReadonlyArray<ServerThreadGroup>;
  readonly devices: ReadonlyArray<DeviceSummary>;
  readonly hostLabelById: ReadonlyMap<string, string>;
  readonly canStop: boolean;
  readonly canShutdown: boolean;
  readonly canStart: boolean;
  readonly projects: ReadonlyArray<StartProjectSection>;
}

interface DevServersActions {
  /** Row keys and device keys with an action in flight. */
  readonly busyKeys: ReadonlySet<string>;
  readonly onStopServer: (environmentId: EnvironmentId, server: DiscoveredLocalServer) => void;
  readonly onShutdownDevice: (environmentId: EnvironmentId, device: DeviceSummary) => void;
  readonly onStartScript: (
    section: StartProjectSection,
    script: ProjectScript,
    threadId: ThreadId,
  ) => void;
  readonly onSelectStartThread: (section: StartProjectSection, threadId: ThreadId) => void;
}

export interface DevServersViewProps extends DevServersActions {
  readonly sections: ReadonlyArray<DevServersEnvironmentSection>;
}

export const devServersDeviceKey = (
  environmentId: EnvironmentId,
  device: Pick<DeviceSummary, "hostId" | "id">,
) => `${environmentId}\u0000${device.hostId}\u0000${device.id}`;

const sectionHasRunning = (section: DevServersEnvironmentSection) =>
  section.serverGroups.length > 0 || section.devices.length > 0;

export function DevServersView(props: DevServersViewProps) {
  const { sections, ...actions } = props;
  const allLoaded = sections.length > 0 && sections.every((section) => section.loaded);
  return (
    <div className="flex flex-col gap-8">
      {sections.some(sectionHasRunning) ? null : allLoaded ? (
        <DevServersEmptyState />
      ) : (
        <p className="text-muted-foreground text-sm">Loading…</p>
      )}
      {sections.map((section) => (
        <DevServersSectionBody
          key={section.environmentId}
          section={section}
          showLabel={sections.length > 1}
          {...actions}
        />
      ))}
    </div>
  );
}

function DevServersEmptyState() {
  return (
    <Empty size="compact" className="min-h-48 flex-none">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ServerIcon />
        </EmptyMedia>
        <EmptyTitle>Nothing running that T3 Code started</EmptyTitle>
        <EmptyDescription>
          Only servers that T3 Code threads and terminals started are listed.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function DevServersSectionBody(
  props: DevServersActions & {
    readonly section: DevServersEnvironmentSection;
    readonly showLabel: boolean;
  },
) {
  const { section, showLabel, ...actions } = props;
  const startProjects = section.canStart ? section.projects : [];
  const showAddScriptsHint = section.canStart && section.projects.length === 0;
  if (!sectionHasRunning(section) && startProjects.length === 0 && !showAddScriptsHint) return null;
  return (
    <section aria-label={section.label} className="flex flex-col gap-6">
      {showLabel ? (
        <h2 className="font-semibold text-base text-foreground">{section.label}</h2>
      ) : null}
      {section.serverGroups.length > 0 ? (
        <Region title="Servers">
          {section.serverGroups.map((group) => (
            <ServerGroup key={group.key} group={group} section={section} {...actions} />
          ))}
        </Region>
      ) : null}
      {section.devices.length > 0 ? (
        <Region title="Devices">
          <ul className="m-0 flex list-none flex-col divide-y rounded-lg border p-0">
            {section.devices.map((device) => (
              <DeviceRow
                key={devServersDeviceKey(section.environmentId, device)}
                device={device}
                section={section}
                {...actions}
              />
            ))}
          </ul>
        </Region>
      ) : null}
      {startProjects.length > 0 ? (
        <Region title="Start">
          {startProjects.map((project) => (
            <StartProject key={project.key} project={project} {...actions} />
          ))}
        </Region>
      ) : showAddScriptsHint ? (
        <Region title="Start">
          <p className="text-muted-foreground text-sm">
            Add project scripts in Settings to start them from here.{" "}
            <EditScriptsLink projectKey={undefined} />
          </p>
        </Region>
      ) : null}
    </section>
  );
}

function Region(props: { readonly title: string; readonly children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {props.title}
      </h3>
      {props.children}
    </div>
  );
}

function ServerGroup(
  props: DevServersActions & {
    readonly group: ServerThreadGroup;
    readonly section: DevServersEnvironmentSection;
  },
) {
  const { group, section } = props;
  return (
    <div className="flex flex-col rounded-lg border">
      <div className="flex min-w-0 flex-col border-b px-3 py-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="truncate font-medium text-sm">
            {group.threadTitle ?? "Thread not loaded"}
          </span>
          {group.threadTitle === null ? (
            <Tooltip>
              <TooltipTrigger
                render={<span className="shrink-0 font-mono text-muted-foreground text-xs" />}
              >
                {group.threadId.slice(group.threadId.indexOf(":") + 1).slice(0, 8)}
              </TooltipTrigger>
              <TooltipPopup>{group.threadId}</TooltipPopup>
            </Tooltip>
          ) : null}
          {group.projectName ? (
            <span className="ms-auto truncate text-muted-foreground text-xs">
              {group.projectName}
            </span>
          ) : null}
        </div>
        {group.checkoutPath ? (
          <Tooltip>
            <TooltipTrigger
              render={<span className="truncate font-mono text-muted-foreground text-xs" />}
            >
              {group.checkoutPath}
            </TooltipTrigger>
            <TooltipPopup>{group.checkoutPath}</TooltipPopup>
          </Tooltip>
        ) : null}
      </div>
      <ul className="m-0 flex list-none flex-col divide-y p-0">
        {group.rows.map((row) => {
          const { server } = row;
          const busy = props.busyKeys.has(row.key);
          return (
            <li key={row.key} className="flex min-h-11 items-center gap-3 px-3 py-1.5">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium text-sm">localhost:{server.port}</span>
                <span className="truncate text-muted-foreground text-xs">
                  {[row.ownerKind === "agent" ? "Agent" : "Terminal", server.processName]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              {section.canStop && server.pid !== null ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        size="icon-xs"
                        variant="ghost-destructive"
                        aria-label={`Stop localhost:${server.port}`}
                        disabled={busy}
                        onClick={() => props.onStopServer(section.environmentId, server)}
                      />
                    }
                  >
                    {busy ? (
                      <LoaderCircleIcon aria-hidden className="size-3 animate-spin" />
                    ) : (
                      <SquareIcon aria-hidden className="size-3 fill-current" />
                    )}
                  </TooltipTrigger>
                  <TooltipPopup side="left">Stop server</TooltipPopup>
                </Tooltip>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DeviceRow(
  props: DevServersActions & {
    readonly device: DeviceSummary;
    readonly section: DevServersEnvironmentSection;
  },
) {
  const { device, section } = props;
  const busy = props.busyKeys.has(devServersDeviceKey(section.environmentId, device));
  const PlatformIcon = device.platform === "ios" ? AppleIcon : AndroidIcon;
  return (
    <li className="flex min-h-11 items-center gap-3 px-3 py-1.5">
      <PlatformIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium text-sm">{device.name}</span>
        <span className="truncate text-muted-foreground text-xs">
          {[device.version, section.hostLabelById.get(device.hostId)].filter(Boolean).join(" · ")}
        </span>
      </span>
      {section.canShutdown ? (
        <Button
          size="xs"
          variant="outline"
          aria-label={`Shut down ${device.name}`}
          disabled={busy}
          onClick={() => props.onShutdownDevice(section.environmentId, device)}
        >
          {busy ? (
            <LoaderCircleIcon aria-hidden className="animate-spin" />
          ) : (
            <PowerIcon aria-hidden />
          )}
          Shut down
        </Button>
      ) : null}
    </li>
  );
}

function StartProject(props: DevServersActions & { readonly project: StartProjectSection }) {
  const { project } = props;
  const { targetThreadId } = project;
  const target = project.threads.find((thread) => thread.threadId === targetThreadId);
  return (
    <div className="flex flex-col rounded-lg border">
      <div className="flex min-w-0 items-center gap-3 border-b px-3 py-2">
        <span className="min-w-0 flex-1 truncate font-medium text-sm">{project.projectName}</span>
        <EditScriptsLink projectKey={project.settingsProjectKey} />
        {project.threads.length > 0 ? (
          <Select
            value={targetThreadId}
            onValueChange={(next) => {
              const thread = project.threads.find((candidate) => candidate.threadId === next);
              if (thread) props.onSelectStartThread(project, thread.threadId);
            }}
          >
            <SelectTrigger
              size="sm"
              className="w-56 max-w-1/2 shrink"
              aria-label={`Thread to start ${project.projectName} scripts in`}
            >
              <SelectValue>{target?.title}</SelectValue>
            </SelectTrigger>
            <SelectPopup align="end" alignItemWithTrigger={false}>
              {project.threads.map((thread) => (
                <SelectItem key={thread.threadId} value={thread.threadId}>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{thread.title}</span>
                    {thread.worktreePath ? (
                      <span className="truncate text-muted-foreground text-xs">
                        {thread.worktreePath}
                      </span>
                    ) : null}
                  </span>
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        ) : null}
      </div>
      {targetThreadId === null ? (
        <p className="border-b px-3 py-2 text-muted-foreground text-xs">
          Open a thread in this project to start scripts
        </p>
      ) : null}
      <ul className="m-0 flex list-none flex-col divide-y p-0">
        {project.scripts.map((script) => (
          <li key={script.id} className="flex min-h-11 items-center gap-3 px-3 py-1.5">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-medium text-sm">{script.name}</span>
              <span className="truncate font-mono text-muted-foreground text-xs">
                {script.command}
              </span>
            </span>
            <Button
              size="xs"
              variant="outline"
              aria-label={`Start ${script.name} in ${project.projectName}`}
              disabled={targetThreadId === null}
              onClick={() => {
                if (targetThreadId !== null) props.onStartScript(project, script, targetThreadId);
              }}
            >
              <PlayIcon aria-hidden />
              Start
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EditScriptsLink(props: { readonly projectKey: string | undefined }) {
  return (
    <Button
      size="xs"
      variant="link"
      className="px-0 text-muted-foreground"
      render={
        <Link to="/settings/projects" search={{ project: props.projectKey, machine: undefined }} />
      }
    >
      Edit scripts
    </Button>
  );
}
