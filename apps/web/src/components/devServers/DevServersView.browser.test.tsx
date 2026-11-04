import "~/index.css";
import type { ServerThreadGroup } from "@t3tools/client-runtime/state/devServers";
import {
  EnvironmentId,
  ProjectId,
  ThreadId,
  type DiscoveredLocalServer,
  type ProjectScript,
} from "@t3tools/contracts";
import { describe, expect, it, vi } from "vite-plus/test";

import { render } from "../../../test/render";
import {
  DevServersView,
  type DevServersEnvironmentSection,
  type DevServersViewProps,
  type StartProjectSection,
} from "./DevServersView";

const environmentId = EnvironmentId.make("env-a");
const projectId = ProjectId.make("project-1");
const threadOne = ThreadId.make("t1");
const threadTwo = ThreadId.make("t2");

function server(port: number, pid: number | null): DiscoveredLocalServer {
  return {
    host: "localhost",
    port,
    url: `http://localhost:${port}`,
    processName: "node",
    pid,
    terminal: { threadId: threadOne, terminalId: "default" },
  };
}

function group(servers: ReadonlyArray<DiscoveredLocalServer>): ServerThreadGroup {
  return {
    key: `${environmentId}:${threadOne}`,
    environmentId,
    threadId: threadOne,
    threadTitle: "Build the page",
    projectName: "Website",
    checkoutPath: "/repo",
    rows: servers.map((entry) => ({
      key: `${environmentId}:${entry.pid ?? "nopid"}:${entry.port}`,
      environmentId,
      server: entry,
      ownerKind: "terminal",
    })),
  };
}

const devScript: ProjectScript = {
  id: "dev",
  name: "Dev",
  command: "pnpm dev",
  icon: "play",
  runOnWorktreeCreate: false,
};

function startProject(overrides: Partial<StartProjectSection> = {}): StartProjectSection {
  return {
    key: `${environmentId}:${projectId}`,
    environmentId,
    projectId,
    projectName: "Website",
    settingsProjectKey: `${environmentId}:${projectId}`,
    scripts: [devScript],
    threads: [
      { threadId: threadOne, title: "Build the page", worktreePath: "/repo/.worktrees/page" },
      { threadId: threadTwo, title: "Fix the bug", worktreePath: null },
    ],
    targetThreadId: threadOne,
    ...overrides,
  };
}

function section(
  overrides: Partial<DevServersEnvironmentSection> = {},
): DevServersEnvironmentSection {
  return {
    environmentId,
    label: "This Mac",
    loaded: true,
    serverGroups: [],
    devices: [],
    hostLabelById: new Map(),
    canStop: true,
    canShutdown: true,
    canStart: true,
    projects: [],
    ...overrides,
  };
}

function props(sections: ReadonlyArray<DevServersEnvironmentSection>): DevServersViewProps {
  return {
    sections,
    busyKeys: new Set(),
    onStopServer: vi.fn(),
    onShutdownDevice: vi.fn(),
    onStartScript: vi.fn(),
    onSelectStartThread: vi.fn(),
  };
}

describe("DevServersView", () => {
  it("hides Stop when the viewer cannot stop and when the server has no pid", async () => {
    const groups = [group([server(3000, 123), server(3001, null)])];
    await using screen = await render(
      <DevServersView {...props([section({ serverGroups: groups })])} />,
    );

    await expect.element(screen.getByText("localhost:3001")).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Stop localhost:3000" })).toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Stop localhost:3001" }))
      .not.toBeInTheDocument();

    await screen.rerender(
      <DevServersView {...props([section({ serverGroups: groups, canStop: false })])} />,
    );

    await expect
      .element(screen.getByRole("button", { name: "Stop localhost:3000" }))
      .not.toBeInTheDocument();
    await expect.element(screen.getByText("localhost:3000")).toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Stop localhost:3001" }))
      .not.toBeInTheDocument();
  });

  it("disables Start without a target thread and shows the hint", async () => {
    await using screen = await render(
      <DevServersView
        {...props([section({ projects: [startProject({ threads: [], targetThreadId: null })] })])}
      />,
    );

    await expect
      .element(screen.getByRole("button", { name: "Start Dev in Website" }))
      .toBeDisabled();
    await expect
      .element(screen.getByText("Open a thread in this project to start scripts"))
      .toBeVisible();
  });

  it("shows the empty state when nothing is running", async () => {
    await using screen = await render(<DevServersView {...props([section()])} />);

    await expect.element(screen.getByText("Nothing running that T3 Code started")).toBeVisible();
  });

  it("shows no empty state while a section is still loading", async () => {
    await using screen = await render(
      <DevServersView
        {...props([
          section(),
          section({ environmentId: EnvironmentId.make("env-b"), loaded: false }),
        ])}
      />,
    );

    await expect.element(screen.getByText("Loading…")).toBeVisible();
    await expect
      .element(screen.getByText("Nothing running that T3 Code started"))
      .not.toBeInTheDocument();
  });
});
