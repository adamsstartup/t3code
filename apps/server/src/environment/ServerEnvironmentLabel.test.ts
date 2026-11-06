import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

import { resolveServerEnvironmentLabelOverride } from "./ServerEnvironmentLabel.ts";

const withEnv = (env: Record<string, string>) =>
  Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env })));

const tempLabelFile = Effect.fn("tempLabelFile")(function* (contents: string | null) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const dir = yield* fileSystem.makeTempDirectory({ prefix: "t3-label-" });
  const file = path.join(dir, "environment-label");
  if (contents !== null) yield* fileSystem.writeFileString(file, contents);
  return file;
});

describe("resolveServerEnvironmentLabelOverride", () => {
  it.effect("prefers T3CODE_ENVIRONMENT_LABEL over the file", () =>
    Effect.gen(function* () {
      const file = yield* tempLabelFile("From file\n");
      const label = yield* resolveServerEnvironmentLabelOverride(file).pipe(
        withEnv({ T3CODE_ENVIRONMENT_LABEL: "  Macbook  " }),
      );
      expect(label).toBe("Macbook");
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("reads the first non-comment line of the file", () =>
    Effect.gen(function* () {
      const file = yield* tempLabelFile("# shown in T3 Code\n\n  Desktop \nignored\n");
      const label = yield* resolveServerEnvironmentLabelOverride(file).pipe(withEnv({}));
      expect(label).toBe("Desktop");
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("returns null when neither is set", () =>
    Effect.gen(function* () {
      const missing = yield* resolveServerEnvironmentLabelOverride(yield* tempLabelFile(null)).pipe(
        withEnv({}),
      );
      const blank = yield* resolveServerEnvironmentLabelOverride(
        yield* tempLabelFile("  \n# x\n"),
      ).pipe(withEnv({ T3CODE_ENVIRONMENT_LABEL: "   " }));
      const none = yield* resolveServerEnvironmentLabelOverride(undefined).pipe(withEnv({}));
      expect([missing, blank, none]).toEqual([null, null, null]);
    }).pipe(Effect.provide(NodeServices.layer)),
  );
});
