/** Lightweight task-context helpers used by specialists and the judge. */

export function isImplementationTask(prompt: string, taskType: string): boolean {
  const lower = `${taskType} ${prompt}`.toLowerCase();
  return [
    "repo",
    "code",
    "github",
    "implementation",
    "api",
    "backend",
    "frontend",
    "convex",
    "next.js",
    "nextjs",
    "react",
    "stripe",
    "checkout",
    "pricing page",
    "dashboard",
    "build",
    "landing page",
    "scaffold",
  ].some((signal) => lower.includes(signal));
}

export function buildTaskContext(prompt: string, taskType: string): string {
  return [`Task type: ${taskType || "general"}`, "", `User goal:`, prompt].join(
    "\n",
  );
}
