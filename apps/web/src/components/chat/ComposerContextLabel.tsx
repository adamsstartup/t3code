import type { ContextWindowSnapshot } from "@t3tools/client-runtime/state/context-window";
import { memo } from "react";

import { cn } from "~/lib/utils";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { contextLabel } from "./composerContextLabel.logic";

/**
 * How full the model's context is, on a tab rising from the composer's top edge. Rendered inside
 * ComposerSurface.Shell, whose variables give it the composer's own glass in every theme.
 */
export const ComposerContextLabel = memo(function ComposerContextLabel(props: {
  readonly usage: ContextWindowSnapshot | null;
}) {
  const label = contextLabel(props.usage);
  if (label === null) return null;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            data-slot="composer-context-label"
            data-tone={label.tone}
            className={cn(
              "absolute right-(--chat-composer-drawer-inset) bottom-full translate-y-px rounded-t-lg border border-b-0 border-(--chat-composer-outline) px-2.5 pt-0.5 pb-px text-xs text-muted-foreground tabular-nums",
              "bg-(--chat-composer-glass-surface)/(--glass-opacity) backdrop-blur-(--glass-blur) backdrop-saturate-(--glass-saturation)",
              "not-supports-[((backdrop-filter:blur(1px))_or_(-webkit-backdrop-filter:blur(1px)))]:bg-(--chat-composer-glass-surface)",
              "data-[tone=danger]:text-destructive data-[tone=warning]:text-warning",
              // A banner on the composer becomes the top edge; step in past its rounded corner.
              "group-has-data-[composer-banner-surface=attached]/composer-surface:right-[calc(var(--chat-composer-drawer-inset)+1rem)]",
            )}
          />
        }
      >
        <span className="sr-only">Context: </span>
        {label.text}
      </TooltipTrigger>
      <TooltipPopup>{label.description}</TooltipPopup>
    </Tooltip>
  );
});
