import type { ContextWindowSnapshot } from "@t3tools/client-runtime/state/context-window";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { memo, useEffect, useRef } from "react";

import { useLocalStorage } from "~/hooks/useLocalStorage";
import { cn } from "~/lib/utils";
import { orchestrationEnvironment } from "../../state/orchestration";
import { useEnvironmentQuery } from "../../state/query";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { contextLabel, tokenTotalLabel } from "./composerContextLabel.logic";

const LabelView = Schema.Literals(["context", "total"]);
const LABEL_VIEW_STORAGE_KEY = "t3code:composer-context-label-view:v1";

const pillClassName = cn(
  "absolute right-(--chat-composer-drawer-inset) bottom-full translate-y-px rounded-t-lg border border-b-0 border-(--chat-composer-outline) px-2.5 pt-0.5 pb-px text-xs text-muted-foreground tabular-nums",
  "bg-(--chat-composer-glass-surface)/(--glass-opacity) backdrop-blur-(--glass-blur) backdrop-saturate-(--glass-saturation)",
  "not-supports-[((backdrop-filter:blur(1px))_or_(-webkit-backdrop-filter:blur(1px)))]:bg-(--chat-composer-glass-surface)",
  "data-[tone=danger]:text-destructive data-[tone=warning]:text-warning",
  // A banner on the composer becomes the top edge; step in past its rounded corner.
  "group-has-data-[composer-banner-surface=attached]/composer-surface:right-[calc(var(--chat-composer-drawer-inset)+1rem)]",
);

/**
 * How full the model's context is, on a tab rising from the composer's top edge; a click swaps it
 * for what the thread has spent in all. Rendered inside ComposerSurface.Shell, whose variables give
 * it the composer's own glass in every theme.
 */
export const ComposerContextLabel = memo(function ComposerContextLabel(props: {
  readonly usage: ContextWindowSnapshot | null;
  readonly environmentId: EnvironmentId;
  /** Null for a draft, which has no turns to add up. */
  readonly threadId: ThreadId | null;
  /** Changes when a run starts or ends, which is when the recorded spend changes. */
  readonly spendRevision: string;
}) {
  const [view, setView] = useLocalStorage(LABEL_VIEW_STORAGE_KEY, "context", LabelView);
  const totals = useEnvironmentQuery(
    props.threadId === null
      ? null
      : orchestrationEnvironment.threadTokenTotals({
          environmentId: props.environmentId,
          input: { threadId: props.threadId },
        }),
  );
  const { refresh } = totals;
  const seenRevision = useRef(props.spendRevision);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- refetches the thread's spend from the server when a run starts or ends
  useEffect(() => {
    if (seenRevision.current === props.spendRevision) return;
    seenRevision.current = props.spendRevision;
    refresh();
  }, [props.spendRevision, refresh]);

  const context = contextLabel(props.usage);
  if (context === null) return null;
  // A server without this query, or a provider that reports no spend, leaves a plain label.
  const total = tokenTotalLabel(totals.data);
  if (total === null) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              data-slot="composer-context-label"
              data-tone={context.tone}
              className={pillClassName}
            />
          }
        >
          <span className="sr-only">Context: </span>
          {context.text}
        </TooltipTrigger>
        <TooltipPopup>{context.description}</TooltipPopup>
      </Tooltip>
    );
  }
  const showsTotal = view === "total";
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            data-slot="composer-context-label"
            data-view={showsTotal ? "total" : "context"}
            data-tone={showsTotal ? "plain" : context.tone}
            className={cn(
              pillClassName,
              "cursor-pointer outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
              "data-[tone=danger]:hover:text-destructive data-[tone=warning]:hover:text-warning",
            )}
            onClick={() => setView(showsTotal ? "context" : "total")}
          />
        }
      >
        <span className="sr-only">{showsTotal ? "Tokens: " : "Context: "}</span>
        {showsTotal ? total.text : context.text}
      </TooltipTrigger>
      <TooltipPopup>
        <div>{showsTotal ? total.description : context.description}</div>
        <div className="text-muted-foreground">
          {showsTotal ? "Click for context in use" : "Click for the thread's total"}
        </div>
      </TooltipPopup>
    </Tooltip>
  );
});
