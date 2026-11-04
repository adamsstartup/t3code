import { createFileRoute } from "@tanstack/react-router";

import { DevServersPage } from "../components/devServers/DevServersPage";

export const Route = createFileRoute("/_chat/dev-servers")({
  component: DevServersPage,
});
