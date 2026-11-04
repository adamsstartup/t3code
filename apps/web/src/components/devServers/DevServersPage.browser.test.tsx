import "~/index.css";
import {
  scopedProjectKey,
  scopeProjectRef,
  scopeThreadRef,
} from "@t3tools/client-runtime/environment";
import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/models";
import {
  EnvironmentId,
  PreviewStopLocalServerError,
  ProjectId,
  ThreadId,
  type DeviceServiceState,
  type DiscoveredLocalServer,
  type ProjectScript,
} from "@t3tools/contracts";
import * as Cause from "effect/Cause";
import { describe, expect, it, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";

const mocks = vi.hoisted(() => ({
  command: vi.fn(async (_input: unknown): Promise<unknown> => undefined),
  hiddenThreadKeys: new Set<string>(),
  projectGroupingSettings: {
    sidebarProjectGroupingMode: "repository",
    sidebarProjectGroupingOverrides: {},
  },
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
      useHiddenThreadKeys: () => mocks.hiddenThreadKeys,
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
  () =>
    ({
      useClientSettings: () => mocks.projectGroupingSettings,
      useEnvironmentSettings: () => fixtures.settings,
    }) as never,
);
vi.mock(
  import("~/portDiscoveryState"),
  () => ({ useDiscoveredPortsState: () => fixtures.ports }) as never,
);

import { render } from "../../../test/render";
import { usePendingProjectScriptLaunchStore } from "~/pendingProjectScriptLaunchStore";
import { ToastProvider } from "../ui/toast";
import { DevServersPage } from "./DevServersPage";
import { DEV_SERVERS_START_THREAD_BY_PROJECT_KEY } from "./devServersStorage";

const environmentId = EnvironmentId.make("env-a");
const projectId = ProjectId.make("project-1");
const threadA = ThreadId.make("thread-a");
const threadB = ThreadId.make("thread-b");
const projectKey = scopedProjectKey(scopeProjectRef(environmentId, projectId));

const devScript: ProjectScript = {
  id: "dev",
  name: "Dev",
  command: "pnpm dev",
  icon: "play",
  runOnWorktreeCreate: false,
};

function threadShell(id: ThreadId, title: string, updatedAt: string) {
  return {
    environmentId,
    id,
    projectId,
    title,
    worktreePath: null,
    lineage: { parentThreadId: null, relationshipToParent: null, rootThreadId: id },
    updatedAt,
    archivedAt: null,
  } as unknown as EnvironmentThreadShell;
}

function makeFixtures(input: { readonly scripts?: ReadonlyArray<ProjectScript> } = {}) {
  return {
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
        workspaceRoot: "/repo",
        scripts: input.scripts ?? [],
      } as unknown as EnvironmentProject,
    ],
    threads: [
      threadShell(threadA, "Build the page", "2026-01-02T00:00:00.000Z"),
      threadShell(threadB, "Fix the bug", "2026-01-01T00:00:00.000Z"),
    ],
    deviceState: {
      state: { hosts: [], devices: [], hostStatus: "disabled" } as unknown as DeviceServiceState,
      loaded: true,
    },
    settings: {
      projectSettingsOverrides: {},
      projectScriptOverrides: {},
      defaultProjectScripts: [],
    },
    ports: {
      servers: [
        {
          host: "localhost",
          port: 5173,
          url: "http://localhost:5173",
          processName: "node",
          pid: 4242,
          terminal: { threadId: threadA, terminalId: "default" },
        },
      ] satisfies ReadonlyArray<DiscoveredLocalServer>,
      configuredUrlProbing: false,
      loaded: true,
    },
  };
}

let fixtures = makeFixtures();

function setup(input: Parameters<typeof makeFixtures>[0] = {}) {
  fixtures = makeFixtures(input);
  mocks.command.mockReset();
  mocks.command.mockResolvedValue({ _tag: "Success", value: undefined });
  usePendingProjectScriptLaunchStore.setState({ pending: null });
  localStorage.removeItem(DEV_SERVERS_START_THREAD_BY_PROJECT_KEY);
}

describe("DevServersPage", () => {
  it("renders each environment's servers and reports a failed stop", async () => {
    setup();
    const error = new PreviewStopLocalServerError({ reason: "not-found" });
    mocks.command.mockResolvedValue({ _tag: "Failure", cause: Cause.fail(error) });
    await using screen = await render(
      <ToastProvider>
        <DevServersPage />
      </ToastProvider>,
    );

    await expect.element(screen.getByText("Build the page")).toBeVisible();
    await expect
      .element(screen.getByText("Nothing running that T3 Code started"))
      .not.toBeInTheDocument();

    await screen.getByRole("button", { name: "Stop localhost:5173" }).click();

    await expect.element(page.getByText("Could not stop server")).toBeVisible();
    await expect.element(page.getByText(error.message)).toBeVisible();
  });

  it("starts a script in the thread picked in the chooser", async () => {
    setup({ scripts: [devScript] });
    await using screen = await render(<DevServersPage />);

    await screen.getByRole("combobox", { name: "Thread to start Website scripts in" }).click();
    await page.getByRole("option", { name: "Fix the bug" }).click();
    await screen.getByRole("button", { name: "Start Dev in Website" }).click();

    await vi.waitFor(() =>
      expect(usePendingProjectScriptLaunchStore.getState().pending).toEqual({
        threadRef: scopeThreadRef(environmentId, threadB),
        scriptId: devScript.id,
      }),
    );
    expect(
      JSON.parse(localStorage.getItem(DEV_SERVERS_START_THREAD_BY_PROJECT_KEY) ?? "{}"),
    ).toEqual({ [projectKey]: threadB });
  });
});
