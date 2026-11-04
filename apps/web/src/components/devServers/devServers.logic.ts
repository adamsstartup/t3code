import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/models";
import type {
  DeviceServiceState,
  DeviceSummary,
  DiscoveredLocalServer,
  EnvironmentId,
  ProjectScript,
  ThreadId,
} from "@t3tools/contracts";
import * as Schema from "effect/Schema";

export interface OwnedServerRow {
  readonly key: string;
  readonly environmentId: EnvironmentId;
  readonly server: DiscoveredLocalServer;
  readonly ownerKind: "terminal" | "agent";
}

export interface ServerThreadGroup {
  readonly key: string;
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
  /** Null when the owning thread's shell is not loaded. */
  readonly threadTitle: string | null;
  readonly projectName: string | null;
  /** Port ascending. */
  readonly rows: ReadonlyArray<OwnedServerRow>;
}

export const DEV_SERVERS_START_THREAD_BY_PROJECT_KEY = "t3code:dev-servers:start-thread-by-project";
/** Keyed by `scopedProjectKey(projectRef)`, valued by the thread that last started a script. */
export const DevServersStartThreadByProjectSchema = Schema.Record(Schema.String, Schema.String);

function serverOwner(
  server: DiscoveredLocalServer,
): { readonly threadId: ThreadId; readonly kind: OwnedServerRow["ownerKind"] } | null {
  if (server.terminal) return { threadId: server.terminal.threadId, kind: "terminal" };
  if (server.agent) return { threadId: server.agent.threadId, kind: "agent" };
  return null;
}

export function groupOwnedServers(input: {
  readonly environmentId: EnvironmentId;
  readonly servers: ReadonlyArray<DiscoveredLocalServer>;
  readonly threadShells: ReadonlyArray<EnvironmentThreadShell>;
  readonly projects: ReadonlyArray<EnvironmentProject>;
}): ReadonlyArray<ServerThreadGroup> {
  const { environmentId } = input;
  const rowsByThread = new Map<ThreadId, OwnedServerRow[]>();
  for (const server of input.servers) {
    const owner = serverOwner(server);
    if (!owner) continue;
    const row: OwnedServerRow = {
      key: `${environmentId}:${server.pid ?? "nopid"}:${server.port}`,
      environmentId,
      server,
      ownerKind: owner.kind,
    };
    const rows = rowsByThread.get(owner.threadId);
    if (rows) rows.push(row);
    else rowsByThread.set(owner.threadId, [row]);
  }

  const groups = [...rowsByThread].map(([threadId, rows]) => {
    const shell =
      input.threadShells.find(
        (candidate) => candidate.id === threadId && candidate.environmentId === environmentId,
      ) ?? null;
    const project = shell
      ? input.projects.find(
          (candidate) =>
            candidate.id === shell.projectId && candidate.environmentId === environmentId,
        )
      : undefined;
    const group: ServerThreadGroup = {
      key: `${environmentId}:${threadId}`,
      environmentId,
      threadId,
      threadTitle: shell?.title ?? null,
      projectName: project?.title ?? null,
      rows: rows.toSorted((left, right) => left.server.port - right.server.port),
    };
    return { group, updatedAt: shell?.updatedAt ?? null };
  });

  return groups
    .toSorted((left, right) => {
      if (left.updatedAt !== null && right.updatedAt !== null) {
        return right.updatedAt.localeCompare(left.updatedAt);
      }
      if (left.updatedAt !== null) return -1;
      if (right.updatedAt !== null) return 1;
      return left.group.threadId.localeCompare(right.group.threadId);
    })
    .map(({ group }) => group);
}

export function bootedMachineDevices(state: DeviceServiceState): ReadonlyArray<DeviceSummary> {
  const machineHostIds = new Set(
    state.hosts
      .filter((host) => host.kind === "local" || host.kind === "ssh")
      .map((host) => host.id),
  );
  return state.devices.filter(
    (device) => device.booted && !device.physical && machineHostIds.has(device.hostId),
  );
}

export function resolveStartTargetThread(input: {
  readonly threads: ReadonlyArray<EnvironmentThreadShell>;
  readonly rememberedThreadId: ThreadId | null;
}): EnvironmentThreadShell | null {
  const live = input.threads.filter((thread) => thread.archivedAt === null);
  const remembered = live.find((thread) => thread.id === input.rememberedThreadId);
  if (remembered) return remembered;
  return live.reduce<EnvironmentThreadShell | null>(
    (latest, thread) => (latest === null || thread.updatedAt > latest.updatedAt ? thread : latest),
    null,
  );
}

export function sortScriptsForStart(
  scripts: ReadonlyArray<ProjectScript>,
): ReadonlyArray<ProjectScript> {
  return [
    ...scripts.filter((script) => script.previewUrl !== undefined),
    ...scripts.filter((script) => script.previewUrl === undefined),
  ];
}
