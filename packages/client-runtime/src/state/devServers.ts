import {
  isListedThreadLineage,
  type DeviceServiceState,
  type DeviceSummary,
  type DiscoveredLocalServer,
  type EnvironmentId,
  type ProjectScript,
  type ThreadId,
} from "@t3tools/contracts";

import { threadKey } from "./entities.ts";
import type { EnvironmentProject, EnvironmentThreadShell } from "./models.ts";

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
  /** The owning thread's worktree, else its project's root; null when neither is known. */
  readonly checkoutPath: string | null;
  /** Port ascending. */
  readonly rows: ReadonlyArray<OwnedServerRow>;
}

export const ownedServerRowKey = (environmentId: EnvironmentId, server: DiscoveredLocalServer) =>
  `${environmentId}:${server.pid ?? "nopid"}:${server.port}`;

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
      key: ownedServerRowKey(environmentId, server),
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
      checkoutPath: shell?.worktreePath ?? project?.workspaceRoot ?? null,
      rows: [...rows].sort((left, right) => left.server.port - right.server.port),
    };
    return { group, updatedAt: shell?.updatedAt ?? null };
  });

  return [...groups]
    .sort((left, right) => {
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

/** Threads a script can start in: listed, not archived, not hidden by a tag filter; newest first. */
export function startCandidateThreads(
  threads: ReadonlyArray<EnvironmentThreadShell>,
  hiddenThreadKeys: ReadonlySet<string>,
): ReadonlyArray<EnvironmentThreadShell> {
  return threads
    .filter(
      (thread) =>
        thread.archivedAt === null &&
        isListedThreadLineage(thread.lineage) &&
        !hiddenThreadKeys.has(
          threadKey({ environmentId: thread.environmentId, threadId: thread.id }),
        ),
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
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
