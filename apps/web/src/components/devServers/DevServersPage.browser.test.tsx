import "~/index.css";
import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/models";
import {
  EnvironmentId,
  ProjectId,
  ThreadId,
  type DeviceServiceState,
  type DiscoveredLocalServer,
} from "@t3tools/contracts";
import { describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  command: vi.fn(async (_input: unknown) => ({ _tag: "Success" as const, value: undefined })),
}));

vi.mock(
  import("~/state/environments"),
  () =>
    ({
      useEnvironments: () => fixtures.environments,
      useEnvironment: () => fixtures.environments.environments[0],
    }) as never,
);
vi.mock(
  import("~/state/entities"),
  () =>
    ({
      useProjects: () => fixtures.projects,
      useThreadShells: () => fixtures.threads,
    }) as never,
);
vi.mock(import("~/state/device"), async () => {
  const { Atom } = await import("effect/reactivity");
  const allowed = Atom.make(true);
  const noProbe = Atom.make(null);
  return {
    deviceEnvironment: { shutdown: { permissionAtom: () => allowed } },
    deviceHostProbeAtom: () => noProbe,
    NO_DEVICE_PROBE_ATOM: noProbe,
    useDeviceState: () => fixtures.deviceState,
  } as never;
});
vi.mock(import("~/state/preview"), async () => {
  const { Atom } = await import("effect/reactivity");
  const allowed = Atom.make(true);
  return { previewEnvironment: { stopLocalServer: { permissionAtom: () => allowed } } } as never;
});
vi.mock(import("~/state/session"), () => ({ useEnvironmentScope: () => true }) as never);
vi.mock(
  import("~/state/use-atom-command"),
  () => ({ useAtomCommand: () => mocks.command }) as never,
);
vi.mock(
  import("~/hooks/useSettings"),
  () => ({ useEnvironmentSettings: () => fixtures.settings }) as never,
);
vi.mock(
  import("~/portDiscoveryState"),
  () => ({ useDiscoveredPortsState: () => fixtures.ports }) as never,
);

import { render } from "../../../test/render";
import { DevServersPage } from "./DevServersPage";

const environmentId = EnvironmentId.make("env-a");
const projectId = ProjectId.make("project-1");
const threadId = ThreadId.make("thread-1");

const fixtures = {
  environments: {
    environments: [
      {
        environmentId,
        label: "This Mac",
        serverConfig: { environment: { capabilities: { localServerStop: true } } },
      },
    ],
  },
  projects: [
    {
      environmentId,
      id: projectId,
      title: "Website",
      scripts: [],
    } as unknown as EnvironmentProject,
  ],
  threads: [
    {
      environmentId,
      id: threadId,
      projectId,
      title: "Build the page",
      worktreePath: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
      archivedAt: null,
    } as unknown as EnvironmentThreadShell,
  ],
  deviceState: {
    state: { hosts: [], devices: [], hostStatus: "disabled" } as unknown as DeviceServiceState,
    loaded: true,
  },
  settings: { projectSettingsOverrides: {}, projectScriptOverrides: {}, defaultProjectScripts: [] },
  ports: {
    servers: [
      {
        host: "localhost",
        port: 5173,
        url: "http://localhost:5173",
        processName: "node",
        pid: 4242,
        terminal: { threadId, terminalId: "default" },
      },
    ] satisfies ReadonlyArray<DiscoveredLocalServer>,
    configuredUrlProbing: false,
  },
};

describe("DevServersPage", () => {
  it("renders each environment's servers through the view and stops one", async () => {
    mocks.command.mockClear();
    await using screen = await render(<DevServersPage />);

    await expect.element(screen.getByText("Build the page")).toBeVisible();
    await expect
      .element(screen.getByText("Nothing running that T3 Code started"))
      .not.toBeInTheDocument();

    await screen.getByRole("button", { name: "Stop localhost:5173" }).click();

    await vi.waitFor(() =>
      expect(mocks.command).toHaveBeenCalledWith({
        environmentId,
        input: { pid: 4242, port: 5173 },
      }),
    );
  });
});
