import { createLucideIcon } from "lucide-react";
import type { IconNode, LucideIcon } from "lucide-react";

// Icons Lucide does not ship, drawn to its spec so they size, stroke and tint like the rest:
// 24x24 grid, 2px stroke, round caps and joins, no fill, 1px of padding.
const projectIconNodes: Record<string, IconNode> = {
  void: [
    ["circle", { cx: "12", cy: "12", r: "10", key: "0" }],
    ["path", { d: "M12 7a5 5 0 1 0 5 5", key: "1" }],
    ["circle", { cx: "12", cy: "12", r: "1", key: "2" }],
  ],
  "void-web": [
    ["rect", { x: "2", y: "3", width: "20", height: "18", rx: "2", key: "0" }],
    ["path", { d: "M2 8h20", key: "1" }],
    ["circle", { cx: "12", cy: "14.5", r: "3.5", key: "2" }],
  ],
  hotpad: [
    [
      "path",
      {
        d: "M12 13.5a4 4 0 0 1-4-4c0-1.6.8-2.6 1.6-3.6.3 1 .9 1.6 1.6 1.8C11 5.5 11.4 3.6 13 2c.3 2.4 3 4 3 7.5a4 4 0 0 1-4 4z",
        key: "0",
      },
    ],
    ["path", { d: "M8 14.87A9 3.5 0 1 0 16 14.87", key: "1" }],
  ],
  g2: [
    ["rect", { x: "2", y: "8.5", width: "8", height: "7", rx: "3", key: "0" }],
    ["rect", { x: "14", y: "8.5", width: "8", height: "7", rx: "3", key: "1" }],
    ["path", { d: "M10 11.5a2 2 0 0 1 4 0", key: "2" }],
    ["path", { d: "M16.5 12h3", key: "3" }],
  ],
  "android-tv": [
    ["rect", { x: "2", y: "3", width: "20", height: "15", rx: "2", key: "0" }],
    ["path", { d: "M7 22h10", key: "1" }],
    ["path", { d: "M8 14.5a4 4 0 0 1 8 0z", key: "2" }],
    ["path", { d: "m9.5 7.5 1 2.5", key: "3" }],
    ["path", { d: "m14.5 7.5-1 2.5", key: "4" }],
  ],
  "notes-main": [
    ["path", { d: "M13 2 18.5 7.5 19 15.5 13 22 7 19 5 10.5 8.5 4z", key: "0" }],
    ["path", { d: "m13 2-2 8 2 12", key: "1" }],
    ["path", { d: "M5 10.5h6l7.5-3", key: "2" }],
  ],
  "notes-work": [
    ["rect", { x: "2", y: "7", width: "20", height: "14", rx: "2", key: "0" }],
    ["path", { d: "M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2", key: "1" }],
    ["path", { d: "M7 12h10", key: "2" }],
    ["path", { d: "M7 16h6", key: "3" }],
  ],
  "claude-skills": [
    [
      "path",
      {
        d: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z",
        key: "0",
      },
    ],
    ["path", { d: "M12 8v8", key: "1" }],
    ["path", { d: "m8.5 10 7 4", key: "2" }],
    ["path", { d: "m15.5 10-7 4", key: "3" }],
  ],
  "claude-memory": [
    ["path", { d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", key: "0" }],
    ["path", { d: "M3 3v5h5", key: "1" }],
    ["path", { d: "M12 9v6", key: "2" }],
    ["path", { d: "m9.4 10.5 5.2 3", key: "3" }],
    ["path", { d: "m14.6 10.5-5.2 3", key: "4" }],
  ],
  "a2-workflow": [
    ["circle", { cx: "12", cy: "5", r: "3", key: "0" }],
    ["circle", { cx: "5", cy: "19", r: "3", key: "1" }],
    ["circle", { cx: "19", cy: "19", r: "3", key: "2" }],
    ["path", { d: "M10.66 7.68 6.34 16.32", key: "3" }],
    ["path", { d: "m13.34 7.68 4.32 8.64", key: "4" }],
    ["path", { d: "M8.5 12h7", key: "5" }],
  ],
};

const spareIconNodes: Record<string, IconNode> = {
  beacon: [
    ["path", { d: "M8 22 10 10h4l2 12", key: "0" }],
    ["path", { d: "M6 22h12", key: "1" }],
    ["path", { d: "m9 6 3-3 3 3", key: "2" }],
    ["path", { d: "M9 6v4h6V6", key: "3" }],
    ["path", { d: "M9 16h6", key: "4" }],
    ["path", { d: "M6 8H3", key: "5" }],
    ["path", { d: "M21 8h-3", key: "6" }],
  ],
  prism: [
    ["path", { d: "M12 5 5 19h14z", key: "0" }],
    ["path", { d: "M2 14.5 7.5 13", key: "1" }],
    ["path", { d: "m16.5 12.5 5.5-1", key: "2" }],
    ["path", { d: "m17.5 15 4.5 1", key: "3" }],
  ],
  kite: [
    ["path", { d: "M12 2 18 8.5l-6 8.5-6-8.5z", key: "0" }],
    ["path", { d: "M12 2v15", key: "1" }],
    ["path", { d: "M6 8.5h12", key: "2" }],
    ["path", { d: "M12 17c-3 1.5 3 3.5 0 5", key: "3" }],
  ],
  keystone: [
    ["path", { d: "M3 21v-9a9 9 0 0 1 18 0v9h-5v-9a4 4 0 0 0-8 0v9z", key: "0" }],
    ["path", { d: "M9.67 3.31 10.96 8.14", key: "1" }],
    ["path", { d: "M14.33 3.31 13.04 8.14", key: "2" }],
  ],
  loom: [
    ["path", { d: "M8 2v2.5", key: "0" }],
    ["path", { d: "M8 11.5V22", key: "1" }],
    ["path", { d: "M16 2v10.5", key: "2" }],
    ["path", { d: "M16 19.5V22", key: "3" }],
    ["path", { d: "M2 8h10.5", key: "4" }],
    ["path", { d: "M19.5 8H22", key: "5" }],
    ["path", { d: "M2 16h2.5", key: "6" }],
    ["path", { d: "M11.5 16H22", key: "7" }],
  ],
  tempo: [
    ["path", { d: "M9 3h6l4 18H5z", key: "0" }],
    ["path", { d: "M6.1 16h11.8", key: "1" }],
    ["path", { d: "M12 16 17 5", key: "2" }],
  ],
  lantern: [
    ["path", { d: "M12 2v3", key: "0" }],
    ["path", { d: "M9.5 8l1-3h3l1 3", key: "1" }],
    ["path", { d: "M8 8h8", key: "2" }],
    ["path", { d: "M8.5 8 7 11v6l1.5 3h7l1.5-3v-6l-1.5-3", key: "3" }],
    [
      "path",
      { d: "M12 11.5c-1 1.2-1.5 2-1.5 2.8a1.5 1.5 0 0 0 3 0c0-.8-.5-1.6-1.5-2.8z", key: "4" },
    ],
    ["path", { d: "M7 22h10", key: "5" }],
  ],
  chain: [
    [
      "path",
      {
        d: "M11.5 15H12a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h.5",
        key: "0",
      },
    ],
    [
      "path",
      {
        d: "M17.5 9H18a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3h.5",
        key: "1",
      },
    ],
  ],
  pitch: [
    ["path", { d: "M8 2v8a4 4 0 0 0 8 0V2", key: "0" }],
    ["path", { d: "M12 14v8", key: "1" }],
    ["path", { d: "M4 4v4", key: "2" }],
    ["path", { d: "M20 4v4", key: "3" }],
  ],
  bridge: [
    ["path", { d: "M2 16h20", key: "0" }],
    ["path", { d: "M7 20V6", key: "1" }],
    ["path", { d: "M17 20V6", key: "2" }],
    ["path", { d: "M2 11c2.5 0 5-2 5-5 0 4 2 7 5 7s5-3 5-7c0 3 2.5 5 5 5", key: "3" }],
  ],
};

export const customProjectIcons: ReadonlyMap<string, LucideIcon> = new Map(
  Object.entries({ ...projectIconNodes, ...spareIconNodes }).map(([name, node]) => [
    name,
    createLucideIcon(name, node),
  ]),
);

export const customProjectIconNames: ReadonlyArray<string> = [...customProjectIcons.keys()];
