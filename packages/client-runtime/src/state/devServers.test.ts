import {
  EnvironmentId,
  ProjectId,
  ThreadId,
  type DeviceHostSummary,
  type DeviceServiceState,
  type DeviceSummary,
  type DiscoveredLocalServer,
  type ProjectScript,
} from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  bootedMachineDevices,
  groupOwnedServers,
  resolveStartTargetThread,
  sortScriptsForStart,
  startCandidateThreads,
} from "./devServers.ts";
import { threadKey } from "./entities.ts";
import type { EnvironmentProject, EnvironmentThreadShell } from "./models.ts";

const environmentId = EnvironmentId.make("env-a");
const projectId = ProjectId.make("project-1");
const threadA = ThreadId.make("thread-a");
const threadB = ThreadId.make("thread-b");

function server(
  input: Partial<DiscoveredLocalServer> & { readonly port: number },
): DiscoveredLocalServer {
  return {
    host: "localhost",
    url: `http://localhost:${input.port}`,
    processName: "node",
    pid: input.port + 10_000,
    terminal: null,
    agent: null,
    ...input,
  } as DiscoveredLocalServer;
}

function terminalServer(threadId: ThreadId, port: number): DiscoveredLocalServer {
  return server({ port, terminal: { threadId, terminalId: "default" } });
}

function agentServer(threadId: ThreadId, port: number): DiscoveredLocalServer {
  return server({ port, agent: { threadId } });
}

function thread(
  input: Partial<EnvironmentThreadShell> & { readonly id: ThreadId },
): EnvironmentThreadShell {
  return {
    environmentId,
    projectId,
    title: `Title ${input.id}`,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    archivedAt: null,
    worktreePath: null,
    lineage: { parentThreadId: null, relationshipToParent: null, rootThreadId: input.id },
    ...input,
  } as EnvironmentThreadShell;
}

function project(input: Partial<EnvironmentProject> = {}): EnvironmentProject {
  return {
    environmentId,
    id: projectId,
    title: "My Project",
    workspaceRoot: "/repo",
    defaultModelSelection: null,
    scripts: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...input,
  } as EnvironmentProject;
}

function device(input: Partial<DeviceSummary> & { readonly id: string }): DeviceSummary {
  return {
    hostId: "local",
    platform: "ios",
    name: `Device ${input.id}`,
    version: "18.0",
    booted: true,
    physical: false,
    ...input,
  } as DeviceSummary;
}

function host(id: string, kind: DeviceHostSummary["kind"]): DeviceHostSummary {
  return {
    id,
    kind,
    label: id,
    platforms: [],
    hubInstalled: true,
    agentDeviceInstalled: true,
  } as DeviceHostSummary;
}

function script(input: Partial<ProjectScript> & { readonly id: string }): ProjectScript {
  return {
    name: input.id,
    command: `run ${input.id}`,
    icon: "play",
    runOnWorktreeCreate: false,
    ...input,
  } as ProjectScript;
}

describe("groupOwnedServers", () => {
  it("groups by owning thread, newest thread first, ports ascending", () => {
    const groups = groupOwnedServers({
      environmentId,
      servers: [
        terminalServer(threadB, 3000),
        agentServer(threadA, 5173),
        terminalServer(threadA, 4000),
      ],
      threadShells: [
        thread({
          id: threadA,
          updatedAt: "2026-01-02T00:00:00.000Z",
          worktreePath: "/repo/.worktrees/a",
        }),
        thread({ id: threadB, updatedAt: "2026-01-01T00:00:00.000Z" }),
      ],
      projects: [project()],
    });

    expect(groups.map((group) => group.key)).toEqual([
      `${environmentId}:${threadA}`,
      `${environmentId}:${threadB}`,
    ]);
    const [groupA, groupB] = groups;
    expect(groupA?.threadTitle).toBe(`Title ${threadA}`);
    expect(groupA?.projectName).toBe("My Project");
    expect(groupA?.rows.map((row) => row.server.port)).toEqual([4000, 5173]);
    expect(groupA?.rows.map((row) => row.ownerKind)).toEqual(["terminal", "agent"]);
    expect(groupA?.checkoutPath).toBe("/repo/.worktrees/a");
    expect(groupB?.checkoutPath).toBe("/repo");
    expect(groupB?.rows.map((row) => row.server.port)).toEqual([3000]);
    expect(groupB?.rows[0]?.key).toBe(`${environmentId}:13000:3000`);
  });

  it("keeps servers whose thread shell is not loaded, after loaded ones, with null title", () => {
    const unloadedZ = ThreadId.make("thread-z");
    const unloadedY = ThreadId.make("thread-y");
    const groups = groupOwnedServers({
      environmentId,
      servers: [
        terminalServer(unloadedZ, 3001),
        terminalServer(threadA, 3000),
        agentServer(unloadedY, 3002),
      ],
      threadShells: [thread({ id: threadA })],
      projects: [project()],
    });

    expect(groups.map((group) => group.threadId)).toEqual([threadA, unloadedY, unloadedZ]);
    expect(groups[1]?.threadTitle).toBeNull();
    expect(groups[1]?.projectName).toBeNull();
    expect(groups[1]?.checkoutPath).toBeNull();
    expect(groups[2]?.rows.map((row) => row.server.port)).toEqual([3001]);
  });

  it("includes an archived thread's servers", () => {
    const groups = groupOwnedServers({
      environmentId,
      servers: [terminalServer(threadA, 3000)],
      threadShells: [thread({ id: threadA, archivedAt: "2026-01-03T00:00:00.000Z" })],
      projects: [project()],
    });

    expect(groups).toHaveLength(1);
    expect(groups[0]?.threadTitle).toBe(`Title ${threadA}`);
  });

  it("drops servers with no terminal and no agent", () => {
    const legacyServer: DiscoveredLocalServer = {
      host: "localhost",
      port: 8081,
      url: "http://localhost:8081",
      processName: null,
      pid: null,
      terminal: null,
    };
    const groups = groupOwnedServers({
      environmentId,
      servers: [server({ port: 8080 }), legacyServer],
      threadShells: [thread({ id: threadA })],
      projects: [project()],
    });

    expect(groups).toEqual([]);
  });

  it("builds row keys that differ across environments for the same pid and port", () => {
    const shared = server({
      port: 3000,
      pid: null,
      terminal: { threadId: threadA, terminalId: "t" },
    });
    const keyFor = (id: string) =>
      groupOwnedServers({
        environmentId: EnvironmentId.make(id),
        servers: [shared],
        threadShells: [],
        projects: [],
      })[0]?.rows[0]?.key;

    expect(keyFor("env-a")).toBe("env-a:nopid:3000");
    expect(keyFor("env-b")).toBe("env-b:nopid:3000");
  });
});

describe("bootedMachineDevices", () => {
  it("keeps booted simulators on local and ssh hosts and drops physical, unbooted, eas and simlock", () => {
    const state = {
      hosts: [
        host("local", "local"),
        host("mac-mini", "ssh"),
        host("eas", "eas"),
        host("simlock", "simlock"),
      ],
      devices: [
        device({ id: "local-booted" }),
        device({ id: "ssh-booted", hostId: "mac-mini" }),
        device({ id: "local-physical", physical: true }),
        device({ id: "local-shutdown", booted: false }),
        device({ id: "eas-booted", hostId: "eas" }),
        device({ id: "simlock-booted", hostId: "simlock" }),
        device({ id: "unknown-host", hostId: "gone" }),
      ],
    } as unknown as DeviceServiceState;

    expect(bootedMachineDevices(state).map((entry) => entry.id)).toEqual([
      "local-booted",
      "ssh-booted",
    ]);
  });
});

describe("startCandidateThreads", () => {
  it("keeps listed, live, visible threads, newest first", () => {
    const older = thread({ id: threadA, updatedAt: "2026-01-01T00:00:00.000Z" });
    const newer = thread({ id: threadB, updatedAt: "2026-01-02T00:00:00.000Z" });
    const subagent = thread({
      id: ThreadId.make("thread-subagent"),
      updatedAt: "2026-01-03T00:00:00.000Z",
      lineage: { parentThreadId: threadA, relationshipToParent: "subagent", rootThreadId: threadA },
    });
    const sideChat = thread({
      id: ThreadId.make("thread-side-chat"),
      lineage: {
        parentThreadId: threadA,
        relationshipToParent: null,
        rootThreadId: threadA,
        sideChat: true,
      },
    });
    const hidden = thread({ id: ThreadId.make("thread-hidden") });
    const archived = thread({
      id: ThreadId.make("thread-archived"),
      archivedAt: "2026-01-04T00:00:00.000Z",
    });
    const fork = thread({
      id: ThreadId.make("thread-fork"),
      updatedAt: "2025-12-31T00:00:00.000Z",
      lineage: { parentThreadId: threadA, relationshipToParent: "fork", rootThreadId: threadA },
    });

    expect(
      startCandidateThreads(
        [older, subagent, sideChat, hidden, archived, newer, fork],
        new Set([threadKey({ environmentId, threadId: hidden.id })]),
      ).map((entry) => entry.id),
    ).toEqual([threadB, threadA, fork.id]);
  });
});

describe("resolveStartTargetThread", () => {
  const older = thread({ id: threadA, updatedAt: "2026-01-01T00:00:00.000Z" });
  const newer = thread({ id: threadB, updatedAt: "2026-01-02T00:00:00.000Z" });

  it("prefers the remembered thread when it is live", () => {
    expect(resolveStartTargetThread({ threads: [older, newer], rememberedThreadId: threadA })).toBe(
      older,
    );
  });

  it("falls back to the most recently updated live thread when the remembered one is gone", () => {
    expect(
      resolveStartTargetThread({
        threads: [older, newer],
        rememberedThreadId: ThreadId.make("thread-deleted"),
      }),
    ).toBe(newer);
    expect(resolveStartTargetThread({ threads: [newer, older], rememberedThreadId: null })).toBe(
      newer,
    );
  });

  it("never picks an archived thread and returns null when none are live", () => {
    const archivedNewest = thread({
      id: ThreadId.make("thread-archived"),
      updatedAt: "2026-01-05T00:00:00.000Z",
      archivedAt: "2026-01-05T00:00:00.000Z",
    });

    expect(
      resolveStartTargetThread({
        threads: [older, archivedNewest],
        rememberedThreadId: archivedNewest.id,
      }),
    ).toBe(older);
    expect(
      resolveStartTargetThread({ threads: [archivedNewest], rememberedThreadId: null }),
    ).toBeNull();
    expect(resolveStartTargetThread({ threads: [], rememberedThreadId: null })).toBeNull();
  });
});

describe("sortScriptsForStart", () => {
  it("moves scripts with a previewUrl first and keeps relative order otherwise", () => {
    const sorted = sortScriptsForStart([
      script({ id: "lint" }),
      script({ id: "web", previewUrl: "http://localhost:5173" }),
      script({ id: "test" }),
      script({ id: "docs", previewUrl: "http://localhost:4000" }),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(["web", "docs", "lint", "test"]);
  });
});
