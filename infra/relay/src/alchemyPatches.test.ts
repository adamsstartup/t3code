// @effect-diagnostics anyUnknownInErrorContext:off - Alchemy provider services expose framework-owned any errors.
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, it } from "@effect/vitest";
import * as Artifacts from "alchemy/Artifacts";
import { Provider } from "alchemy/Provider";
import * as Drizzle from "@alchemy.run/drizzle";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";

// Guards patches/alchemy@2.0.0-beta.85.patch and
// patches/@alchemy.run__drizzle@2.0.0-beta.85.patch; drop with the patches.
const artifacts = () => Artifacts.makeScopedArtifacts(Artifacts.createArtifactStore(), "Test/Fqn");

describe("alchemy patches", () => {
  it.effect("Artifacts.cached hands a failure to callers already waiting on it", () =>
    Effect.gen(function* () {
      const started = yield* Deferred.make<void>();
      const release = yield* Deferred.make<void>();
      const cached = Deferred.succeed(started, undefined).pipe(
        Effect.andThen(Deferred.await(release)),
        Effect.andThen(Effect.fail("boom")),
        Artifacts.cached("key"),
      );

      const first = yield* Effect.exit(cached).pipe(Effect.forkChild);
      yield* Deferred.await(started);
      const second = yield* Effect.exit(cached).pipe(Effect.forkChild({ startImmediately: true }));
      yield* Deferred.succeed(release, undefined);

      assert.deepStrictEqual(yield* Fiber.join(first), Exit.fail("boom"));
      assert.deepStrictEqual(yield* Fiber.join(second), Exit.fail("boom"));
    }).pipe(Effect.provideService(Artifacts.Artifacts, artifacts())),
  );

  it.live("Drizzle.Schema diffs the relay's existing migrations", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const relay = path.resolve(import.meta.dirname, "..");
      const props = {
        schema: path.join(relay, "src/persistence/schema.ts"),
        out: path.join(relay, "migrations/postgres"),
        dialect: "postgres" as const,
      };
      const schema = yield* Provider<Drizzle.Schema>("Drizzle.Schema");
      const diff = yield* schema.diff!({
        id: "RelaySchema",
        fqn: "RelaySchema",
        instanceId: "test",
        olds: props,
        news: props,
        output: {
          out: path.relative(process.cwd(), props.out),
          snapshotHash: "",
          migrations: [],
        },
        oldBindings: [],
        newBindings: [],
      });
      assert.isUndefined(diff);
    }).pipe(
      Effect.provideService(Artifacts.Artifacts, artifacts()),
      Effect.provide(Layer.provideMerge(Drizzle.SchemaProvider(), NodeServices.layer)),
    ),
  );
});
