import type { ContextWindowSnapshot } from "@t3tools/client-runtime/state/context-window";
import type { OrchestrationV2ThreadTokenTotals } from "@t3tools/contracts";

import { formatContextWindowTokens } from "~/lib/contextWindow";

export type ContextLabelTone = "plain" | "warning" | "danger";

/** Half full is worth a glance; four fifths is close enough to compaction to plan around. */
const WARNING_FROM_PERCENT = 50;
const DANGER_FROM_PERCENT = 80;

export function contextLabel(
  usage: Pick<ContextWindowSnapshot, "usedTokens" | "maxTokens" | "usedPercentage"> | null,
): { readonly text: string; readonly tone: ContextLabelTone; readonly description: string } | null {
  if (usage === null) return null;
  const used = formatContextWindowTokens(usage.usedTokens);
  const usedExact = usage.usedTokens.toLocaleString("en-US");
  const maxTokens = usage.maxTokens != null && usage.maxTokens > 0 ? usage.maxTokens : null;
  // Without a limit there is nothing to be full of, so the count carries no colour.
  if (maxTokens === null) {
    return { text: used, tone: "plain", description: `Context: ${usedExact} tokens used` };
  }
  const percent = usage.usedPercentage ?? (usage.usedTokens / maxTokens) * 100;
  return {
    text: `${used} / ${formatContextWindowTokens(maxTokens)}`,
    tone:
      percent >= DANGER_FROM_PERCENT
        ? "danger"
        : percent >= WARNING_FROM_PERCENT
          ? "warning"
          : "plain",
    description: `Context: ${usedExact} of ${maxTokens.toLocaleString("en-US")} tokens (${Math.round(percent)}%)`,
  };
}

const count = (value: number) => value.toLocaleString("en-US");
const turns = (value: number) => `${count(value)} ${value === 1 ? "turn" : "turns"}`;

/** Everything the thread's turns have spent. Null until a turn has reported usage. */
export function tokenTotalLabel(
  totals: OrchestrationV2ThreadTokenTotals | null,
): { readonly text: string; readonly description: string } | null {
  if (totals === null) return null;
  const total = totals.inputTokens + totals.outputTokens;
  if (total === 0) return null;
  // Unmeasured turns spent something the provider never reported, so the sum is a floor.
  const isMinimum = totals.unmeasuredTurns > 0;
  return {
    text: `${formatContextWindowTokens(total)}${isMinimum ? "+" : ""} total`,
    description: [
      `Total: ${isMinimum ? "at least " : ""}${count(total)} tokens over ${turns(totals.measuredTurns)}, main agent only.`,
      `Input ${count(totals.inputTokens)} (${count(totals.cachedInputTokens)} cached), output ${count(totals.outputTokens)}.`,
      ...(isMinimum ? [`${turns(totals.unmeasuredTurns)} reported no usage.`] : []),
    ].join(" "),
  };
}
