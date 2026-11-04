import { ThreadId } from "@t3tools/contracts";
import * as Schema from "effect/Schema";

export const DEV_SERVERS_START_THREAD_BY_PROJECT_KEY = "t3code:dev-servers:start-thread-by-project";
/** Keyed by `scopedProjectKey(projectRef)`, valued by the thread that last started a script. */
export const DevServersStartThreadByProjectSchema = Schema.Record(Schema.String, ThreadId);
