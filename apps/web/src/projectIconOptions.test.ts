import { AlarmClockCheck, ArrowDown01, Layers3 } from "lucide-react";
import { describe, expect, it } from "vite-plus/test";
import { customProjectIconNames } from "./lib/customProjectIcons";
import { lucideIconByName, lucideIconNames } from "./lib/lucideIconByName";
import { filterProjectIconNames, firstEmoji } from "./projectIconOptions";

describe("projectIconOptions", () => {
  it("resolves every offered icon name, including saved legacy spellings", () => {
    for (const name of filterProjectIconNames("")) expect(lucideIconByName(name)).toBeDefined();
    expect(lucideIconByName("layers-3")).toBe(Layers3);
    expect(lucideIconByName("arrow-down-01")).toBe(ArrowDown01);
    expect(lucideIconByName("arrow-down-0-1")).toBe(ArrowDown01);
    expect(lucideIconByName("alarm-check")).toBe(AlarmClockCheck);
    expect(lucideIconByName("create-lucide-icon")).toBeUndefined();
  });

  it("offers each custom icon once, under a name Lucide does not use", () => {
    expect(customProjectIconNames).toHaveLength(31);
    expect(filterProjectIconNames("").slice(0, 31)).toEqual(customProjectIconNames);
    expect(filterProjectIconNames("void")).toEqual(["void", "void-web"]);
    const offered = lucideIconNames.filter((name) => customProjectIconNames.includes(name));
    expect(offered).toEqual(customProjectIconNames);
    expect(lucideIconByName("hotpad")?.displayName).toBe("Hotpad");
  });

  it("extracts one complete emoji grapheme", () => {
    expect(firstEmoji("  👩🏽‍💻 hello")).toBe("👩🏽‍💻");
    expect(firstEmoji("🇺🇸 project")).toBe("🇺🇸");
    expect(firstEmoji("1️⃣ project")).toBe("1️⃣");
    expect(firstEmoji("plain text")).toBeNull();
  });
});
