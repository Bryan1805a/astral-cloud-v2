import type { ContainerRuntime } from "./types";
import { MockRuntime } from "./mock";
import { DockerRuntime } from "./docker";

export function createRuntime(driver?: string): ContainerRuntime {
  const selected = driver || process.env.CONTAINER_RUNTIME_DRIVER || "mock";

  switch (selected) {
    case "docker":
      return new DockerRuntime();
    case "mock":
    default:
      return new MockRuntime();
  }
}
