import { lazy, Suspense } from "react";

import { useComposerSendLaterRequest } from "./composerSendLaterRequest";

// The editor is a large module; load it when someone first schedules from a composer.
const ComposerSendLaterDialog = lazy(() =>
  import("./ComposerSendLaterDialog").then((module) => ({
    default: module.ComposerSendLaterDialog,
  })),
);

/** Mounted at the root, so the dialog outlives composer re-renders and takes none of its events. */
export function ComposerSendLaterHost() {
  const request = useComposerSendLaterRequest((state) => state.request);
  if (request === null) return null;
  return (
    <Suspense fallback={null}>
      <ComposerSendLaterDialog request={request} />
    </Suspense>
  );
}
