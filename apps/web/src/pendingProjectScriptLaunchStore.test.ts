import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { usePendingProjectScriptLaunchStore } from "./pendingProjectScriptLaunchStore";

const refA = scopeThreadRef(EnvironmentId.make("env-1"), ThreadId.make("thread-A"));
const refB = scopeThreadRef(EnvironmentId.make("env-1"), ThreadId.make("thread-B"));

describe("pendingProjectScriptLaunchStore", () => {
  it("claims only for the matching thread when the script is known", () => {
    const store = usePendingProjectScriptLaunchStore;
    store.setState({ pending: null });
    store.getState().request({ threadRef: refA, scriptId: "dev" });
    expect(store.getState().claim(refB, ["dev"])).toBeNull();
    expect(store.getState().claim(refA, ["other"])).toBeNull();
    expect(store.getState().pending?.scriptId).toBe("dev");
    expect(store.getState().claim(refA, ["dev"])).toEqual({ threadRef: refA, scriptId: "dev" });
    expect(store.getState().pending).toBeNull();
  });

  it("replaces an earlier request", () => {
    const store = usePendingProjectScriptLaunchStore;
    store.setState({ pending: null });
    store.getState().request({ threadRef: refA, scriptId: "dev" });
    store.getState().request({ threadRef: refB, scriptId: "test" });
    expect(store.getState().claim(refA, ["dev", "test"])).toBeNull();
    expect(store.getState().claim(refB, ["dev", "test"])).toEqual({
      threadRef: refB,
      scriptId: "test",
    });
    expect(store.getState().pending).toBeNull();
  });
});
