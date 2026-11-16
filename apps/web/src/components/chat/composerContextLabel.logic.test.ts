import { describe, expect, it } from "vite-plus/test";

import { contextLabel, tokenTotalLabel } from "./composerContextLabel.logic";

describe("contextLabel", () => {
  it("shows nothing before the model reports usage", () => {
    expect(contextLabel(null)).toBeNull();
  });

  it("shows tokens in use out of the limit", () => {
    expect(contextLabel({ usedTokens: 84_210, maxTokens: 200_000, usedPercentage: 42.1 })).toEqual({
      text: "84k / 200k",
      tone: "plain",
      description: "Context: 84,210 of 200,000 tokens (42%)",
    });
  });

  it.each([
    [49.9, "plain"],
    [50, "warning"],
    [79.9, "warning"],
    [80, "danger"],
    [130, "danger"],
  ] as const)("at %s%% the tone is %s", (usedPercentage, tone) => {
    expect(contextLabel({ usedTokens: 1_000, maxTokens: 200_000, usedPercentage })?.tone).toBe(
      tone,
    );
  });

  it.each([null, 0])(
    "stays plain and shows only the used count when the limit is %s",
    (maxTokens) => {
      expect(contextLabel({ usedTokens: 84_210, maxTokens, usedPercentage: null })).toEqual({
        text: "84k",
        tone: "plain",
        description: "Context: 84,210 tokens used",
      });
    },
  );

  it("ignores a percentage that arrives without a usable limit", () => {
    expect(contextLabel({ usedTokens: 84_210, maxTokens: 0, usedPercentage: 95 })?.tone).toBe(
      "plain",
    );
  });
});

describe("tokenTotalLabel", () => {
  const totals = {
    inputTokens: 12_100_000,
    cachedInputTokens: 11_000_000,
    outputTokens: 300_000,
    measuredTurns: 8,
    unmeasuredTurns: 0,
  };

  it("adds input and output into one total", () => {
    expect(tokenTotalLabel(totals)).toEqual({
      text: "12.4m total",
      description:
        "Total: 12,400,000 tokens over 8 turns, main agent only. Input 12,100,000 (11,000,000 cached), output 300,000.",
    });
  });

  it("marks the total as a minimum when some turns reported no usage", () => {
    expect(tokenTotalLabel({ ...totals, measuredTurns: 1, unmeasuredTurns: 2 })).toEqual({
      text: "12.4m+ total",
      description:
        "Total: at least 12,400,000 tokens over 1 turn, main agent only. Input 12,100,000 (11,000,000 cached), output 300,000. 2 turns reported no usage.",
    });
  });

  it("has nothing to show before the server answers or when no turn reported usage", () => {
    expect(tokenTotalLabel(null)).toBeNull();
    expect(
      tokenTotalLabel({
        inputTokens: 0,
        cachedInputTokens: 0,
        outputTokens: 0,
        measuredTurns: 0,
        unmeasuredTurns: 4,
      }),
    ).toBeNull();
  });
});
