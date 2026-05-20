import path from "node:path";

export function projectRuntimeRoot(runtimeRoot: string, projectId: string): string {
  const cleanProjectId = sanitizeProjectId(projectId);
  return cleanProjectId ? path.join(runtimeRoot, "projects", cleanProjectId) : runtimeRoot;
}

export function sanitizeProjectId(projectId: string): string {
  return projectId.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

export function sanitizeTopicPathToken(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
}
