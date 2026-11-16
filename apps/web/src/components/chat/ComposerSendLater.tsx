import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentId } from "@t3tools/contracts";
import { CalendarClockIcon } from "lucide-react";
import { memo, type PointerEventHandler } from "react";

import { serverEnvironment } from "../../state/server";
import { Button } from "../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { composerSendLaterState } from "./composerSendLater.logic";

const keepFocus: PointerEventHandler<HTMLElement> = (event) => {
  event.preventDefault();
};

export const ComposerSendLaterButton = memo(function ComposerSendLaterButton(props: {
  readonly environmentId: EnvironmentId;
  readonly hidden: boolean;
  readonly promptHasText: boolean;
  readonly hasNonTextContent: boolean;
  readonly environmentAvailable: boolean;
  readonly dictating: boolean;
  readonly onOpen: () => void;
}) {
  const canSchedule = useAtomValue(
    serverEnvironment.upsertScheduledTask.permissionAtom(props.environmentId),
  );
  const state = composerSendLaterState({
    hidden: props.hidden,
    promptHasText: props.promptHasText,
    hasNonTextContent: props.hasNonTextContent,
    canSchedule,
    environmentAvailable: props.environmentAvailable,
    dictating: props.dictating,
  });
  if (state.kind === "hidden") return null;
  const disabledReason = state.kind === "disabled" ? state.reason : null;
  return (
    <Tooltip>
      {/* The span keeps the tooltip reachable while the button is disabled. */}
      <TooltipTrigger render={<span className="inline-flex shrink-0" />}>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="Send later"
          disabled={disabledReason !== null}
          onPointerDown={keepFocus}
          onClick={props.onOpen}
        >
          <CalendarClockIcon />
        </Button>
      </TooltipTrigger>
      <TooltipPopup>{disabledReason ?? "Send later"}</TooltipPopup>
    </Tooltip>
  );
});
