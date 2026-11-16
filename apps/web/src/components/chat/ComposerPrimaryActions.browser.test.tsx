import "~/index.css";

import type { ComponentProps } from "react";
import { expect, it, vi } from "vite-plus/test";
import { act, fakeTimers, render } from "../../../test/render";

vi.mock("~/hooks/useSettings", () => ({
  useEnvironmentIdentificationMode: () => "none",
  useClientSettings: () => false,
}));
vi.mock("../SidebarStageBackdrop", () => ({
  StageBackdropButtonArt: () => null,
  useSidebarStageBackdropVariant: () => null,
}));

import { CollapsedComposerStopAction, ComposerPrimaryActions } from "./ComposerPrimaryActions";

function setup() {
  return {
    compact: true,
    canOperateThread: true,
    pendingAction: null,
    isRunning: true,
    canInterrupt: true,
    canResume: false,
    isSendBusy: false,
    sendDisabledReason: null,
    isEnvironmentUnavailable: false,
    isPreparingWorktree: false,
    hasSendableContent: false,
    onPreviousPendingQuestion: vi.fn(),
    onInterrupt: vi.fn(),
    onResume: vi.fn(),
    onSubmitMessage: vi.fn(),
  } satisfies ComponentProps<typeof ComposerPrimaryActions>;
}

it.each(["resume", "draft", "question"] as const)(
  "keeps repeat Stop clicks from reaching the action that replaces it (%s)",
  async (mode) => {
    const props = setup();
    const submit = vi.fn();
    const pendingAction =
      mode === "question"
        ? {
            questionIndex: 0,
            isLastQuestion: true,
            canAdvance: true,
            isResponding: false,
            isComplete: true,
          }
        : null;
    const view = (overrides: Partial<ComponentProps<typeof ComposerPrimaryActions>> = {}) => (
      <form
        style={{ display: "flex", justifyContent: "flex-end", width: "400px" }}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <ComposerPrimaryActions {...props} pendingAction={pendingAction} {...overrides} />
      </form>
    );
    await using screen = await render(view());
    using _timers = fakeTimers();
    const stop = screen
      .getByRole("button", { name: "Stop generation" })
      .element() as HTMLButtonElement;
    const { x, y, width, height } = stop.getBoundingClientRect();
    const target = () =>
      document.elementFromPoint(x + width / 2, y + height / 2)?.closest("button");
    await act(() => stop.click());
    await act(() =>
      (
        screen.getByRole("button", { name: "Stopping", exact: true }).element() as HTMLButtonElement
      ).click(),
    );
    expect(screen.getByRole("button", { name: "Stopping", exact: true }).element()).toBeDisabled();
    expect(props.onInterrupt).toHaveBeenCalledTimes(1);
    await screen.rerender(
      view({
        isRunning: false,
        canInterrupt: false,
        canResume: true,
        hasSendableContent: mode === "draft",
      }),
    );
    const action = { resume: "Resume thread", draft: "Submit message", question: "Submit" }[mode];
    expect(screen.getByRole("button", { name: "Stop generation" }).query()).toBeNull();
    expect(target()).toBe(screen.getByRole("button", { name: action, exact: true }).element());
    await act(() => {
      for (let i = 0; i < 20; i++) target()?.click();
    });
    await act(() => vi.advanceTimersByTime(499));
    await act(() => target()?.click());
    expect(props.onResume).not.toHaveBeenCalled();
    expect(props.onSubmitMessage).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTime(1));
    await act(() => target()?.click());
    expect(
      { resume: props.onResume, draft: props.onSubmitMessage, question: submit }[mode],
    ).toHaveBeenCalledTimes(1);
    await screen.rerender(view());
    expect(screen.getByRole("button", { name: "Stop generation" }).element()).toBeEnabled();
  },
);

it("allows retry after ten seconds and protects a late stop", async () => {
  const props = setup();
  await using screen = await render(<ComposerPrimaryActions {...props} />);
  using _timers = fakeTimers();
  await act(() =>
    (
      screen.getByRole("button", { name: "Stop generation" }).element() as HTMLButtonElement
    ).click(),
  );
  await act(() => vi.advanceTimersByTime(9_999));
  expect(screen.getByRole("button", { name: "Stopping", exact: true }).element()).toBeDisabled();
  await act(() => vi.advanceTimersByTime(1));
  await act(() =>
    (
      screen.getByRole("button", { name: "Stop generation" }).element() as HTMLButtonElement
    ).click(),
  );
  await screen.rerender(
    <ComposerPrimaryActions {...props} isRunning={false} canInterrupt={false} canResume />,
  );
  await act(() =>
    (screen.getByRole("button", { name: "Resume thread" }).element() as HTMLButtonElement).click(),
  );
  expect(props.onInterrupt).toHaveBeenCalledTimes(2);
  expect(props.onResume).not.toHaveBeenCalled();
});

it("keeps Stop pending across a permission failure", async () => {
  const props = setup();
  await using screen = await render(<ComposerPrimaryActions {...props} />);
  await act(() =>
    (
      screen.getByRole("button", { name: "Stop generation" }).element() as HTMLButtonElement
    ).click(),
  );
  await screen.rerender(
    <ComposerPrimaryActions {...props} canOperateThread={false} canInterrupt={false} />,
  );
  await screen.rerender(<ComposerPrimaryActions {...props} />);
  await expect
    .element(screen.getByRole("button", { name: "Stopping", exact: true }))
    .toBeDisabled();
  expect(props.onInterrupt).toHaveBeenCalledTimes(1);
});

it("keeps a pending stop when the run id clears and resets it for a different run", async () => {
  const props = setup();
  await using screen = await render(<ComposerPrimaryActions {...props} runId="first" />);
  await act(() =>
    (
      screen.getByRole("button", { name: "Stop generation" }).element() as HTMLButtonElement
    ).click(),
  );
  await screen.rerender(<ComposerPrimaryActions {...props} runId={null} />);
  expect(screen.getByRole("button", { name: "Stopping", exact: true }).element()).toBeDisabled();
  await screen.rerender(<ComposerPrimaryActions {...props} runId="second" />);
  expect(screen.getByRole("button", { name: "Stop generation" }).element()).toBeEnabled();
});

it("swaps the collapsed composer's send button for Stop while a turn can be stopped", async () => {
  const onInterrupt = vi.fn();
  const collapsed = (overrides: { canInterrupt?: boolean; hasSendableContent?: boolean } = {}) => (
    <CollapsedComposerStopAction
      canOperateThread
      canInterrupt={overrides.canInterrupt ?? true}
      runId="run"
      hasSendableContent={overrides.hasSendableContent ?? false}
      isEditingQueuedMessage={false}
      onInterrupt={onInterrupt}
    >
      <button type="button">Send message</button>
    </CollapsedComposerStopAction>
  );
  await using screen = await render(collapsed({ hasSendableContent: true }));
  await expect.element(screen.getByRole("button", { name: "Send message" })).toBeVisible();
  await screen.rerender(collapsed());
  await act(() =>
    (
      screen.getByRole("button", { name: "Stop generation" }).element() as HTMLButtonElement
    ).click(),
  );
  expect(onInterrupt).toHaveBeenCalledTimes(1);
  await expect
    .element(screen.getByRole("button", { name: "Stopping", exact: true }))
    .toBeDisabled();
  await screen.rerender(collapsed({ canInterrupt: false }));
  await expect.element(screen.getByRole("button", { name: "Send message" })).toBeVisible();
});

it("offers Queue and Steer as separate actions while a turn runs", async () => {
  const props = { ...setup(), hasSendableContent: true, compact: false };
  const onQueueMessage = vi.fn();
  const onSteerMessage = vi.fn();
  const submit = vi.fn();
  const view = (overrides: Partial<ComponentProps<typeof ComposerPrimaryActions>> = {}) => (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <ComposerPrimaryActions
        {...props}
        onQueueMessage={onQueueMessage}
        onSteerMessage={onSteerMessage}
        {...overrides}
      />
    </form>
  );
  await using screen = await render(view());
  const queue = screen.getByRole("button", { name: "Queue message", exact: true });
  const steer = screen.getByRole("button", { name: "Steer message", exact: true });
  await act(() => (queue.element() as HTMLButtonElement).click());
  expect(onQueueMessage).toHaveBeenCalledTimes(1);
  expect(onSteerMessage).not.toHaveBeenCalled();
  await act(() => (steer.element() as HTMLButtonElement).click());
  expect(onSteerMessage).toHaveBeenCalledTimes(1);
  expect(onQueueMessage).toHaveBeenCalledTimes(1);
  // Each button names its own mode, so neither falls through to the form's default dispatch.
  expect(submit).not.toHaveBeenCalled();
  expect(props.onSubmitMessage).not.toHaveBeenCalled();
  expect(
    queue.element().compareDocumentPosition(steer.element()) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();

  await screen.rerender(view({ canSteer: false }));
  await expect.element(queue).toBeEnabled();
  expect(steer.query()).toBeNull();

  // A send declines a shown approval, so queueing behind the waiting turn is not offered.
  await screen.rerender(view({ canQueue: false }));
  await expect.element(steer).toBeEnabled();
  expect(queue.query()).toBeNull();
  // Something must still send when the turn takes no steer either.
  await screen.rerender(view({ canQueue: false, canSteer: false }));
  await expect.element(queue).toBeEnabled();

  await screen.rerender(view({ isRunning: false, canInterrupt: false }));
  await expect
    .element(screen.getByRole("button", { name: "Submit message", exact: true }))
    .toBeEnabled();
  expect(queue.query()).toBeNull();
  expect(steer.query()).toBeNull();
});
