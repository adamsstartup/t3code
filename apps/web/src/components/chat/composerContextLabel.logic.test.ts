import { describe, expect, it } from "vite-plus/test";

import { contextLabel } from "./composerContextLabel.logic";

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
