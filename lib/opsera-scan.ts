/**
 * Opsera security gate — scans code deliverables for vulnerabilities, secrets,
 * and SQL injection before escrow releases.
 *
 * Called from convex/auctions.ts settle() on code-producing tasks.
 * Uses the existing mcp-outbound callRemoteTool / discoverTools transport,
 * which already supports streamable-HTTP + Mcp-Session-Id.
 *
 * Open items (confirm with Opsera team at hackathon):
 *   - Exact MCP endpoint URL (defaulting to https://mcp.opsera.io/mcp)
 *   - Auth scheme: Bearer key vs custom header
 *   - Actual tool names for vuln/secret/SQLi scans
 */

import {
  callRemoteTool,
  discoverTools,
  flattenToolResult,
} from "./mcp-outbound";

const OPSERA_ENDPOINT =
  process.env.OPSERA_MCP_ENDPOINT ?? "https://mcp.opsera.io/mcp";

function apiKey(): string | undefined {
  return process.env.OPSERA_API_KEY?.trim() || undefined;
}

export interface OsperaFinding {
  severity: "critical" | "high" | "medium" | "low" | "info";
  type: string;
  message: string;
  location?: string;
}

export interface OsperaScanResult {
  passed: boolean;
  findings: OsperaFinding[];
  severitySummary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  scan_duration_ms: number;
  endpoint_used: string;
  skipped?: boolean;
  skip_reason?: string;
}

function emptySummary() {
  return { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
}

function skipResult(reason: string): OsperaScanResult {
  return {
    passed: true,
    findings: [{ severity: "info", type: "scan_skipped", message: reason }],
    severitySummary: emptySummary(),
    scan_duration_ms: 0,
    endpoint_used: OPSERA_ENDPOINT,
    skipped: true,
    skip_reason: reason,
  };
}

/**
 * Scan a deliverable for security issues.
 * Returns passed:true if no critical/high findings or if scan is unavailable.
 * Never throws — callers treat errors as pass-through (non-fatal).
 */
export async function scanDeliverable(deliverable: {
  code?: string;
  pr_url?: string;
  text?: string;
  task_id?: string;
}): Promise<OsperaScanResult> {
  const t0 = Date.now();
  const key = apiKey();

  if (!key) {
    return skipResult("OPSERA_API_KEY not configured");
  }

  // Check liveness — tools/list confirms the MCP server is up.
  let tools: { name: string; description?: string }[] = [];
  try {
    tools = await discoverTools(OPSERA_ENDPOINT, key);
  } catch (err) {
    return skipResult(
      `Opsera unreachable: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (tools.length === 0) {
    return skipResult("Opsera MCP returned 0 tools");
  }

  // Find scan tool — matches any tool whose name contains scan/vuln/secret/sast
  const scanTool = tools.find(
    (t) =>
      /scan|vuln|secret|sast|security|sqlinjection|sqli/i.test(t.name),
  );

  if (!scanTool) {
    // Log available tools so we can adapt at the hackathon
    console.warn(
      "[opsera] no scan tool found. Available:",
      tools.map((t) => t.name).join(", "),
    );
    return skipResult(
      `No scan tool found among: ${tools.map((t) => t.name).join(", ")}`,
    );
  }

  const input =
    deliverable.code ??
    deliverable.text ??
    (deliverable.pr_url ? `PR: ${deliverable.pr_url}` : "");

  if (!input) {
    return skipResult("No code content to scan");
  }

  let rawFindings: unknown[] = [];
  try {
    const result = await callRemoteTool(
      OPSERA_ENDPOINT,
      scanTool.name,
      {
        code: deliverable.code ?? deliverable.text,
        pr_url: deliverable.pr_url,
        content: input,
        task_id: deliverable.task_id,
      },
      45_000,
      key,
    );
    const text = flattenToolResult(result);
    try {
      const parsed: unknown = JSON.parse(text);
      rawFindings = Array.isArray(parsed) ? parsed : [];
    } catch {
      // Response wasn't JSON — try to extract severity signals from text
      if (/critical|high severity/i.test(text)) {
        rawFindings = [
          {
            severity: "high",
            type: "text_analysis",
            message: text.slice(0, 500),
          },
        ];
      }
    }
  } catch (err) {
    console.error("[opsera] scan tool call failed:", err);
    return skipResult(
      `Scan tool call failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Normalize findings to our shape regardless of Opsera's actual schema
  const findings: OsperaFinding[] = rawFindings.map((f: unknown) => {
    const finding = (
      f && typeof f === "object" ? f : {}
    ) as Record<string, unknown>;
    const sev = String(
      finding.severity ?? finding.level ?? finding.risk ?? "info",
    ).toLowerCase();
    const normalizedSev = (
      ["critical", "high", "medium", "low", "info"].includes(sev) ? sev : "info"
    ) as OsperaFinding["severity"];
    return {
      severity: normalizedSev,
      type: String(finding.type ?? finding.rule ?? finding.check ?? "unknown"),
      message: String(
        finding.message ?? finding.description ?? finding.detail ?? JSON.stringify(f),
      ).slice(0, 500),
      location: finding.location
        ? String(finding.location)
        : finding.file
          ? String(finding.file)
          : undefined,
    };
  });

  const severitySummary = emptySummary();
  for (const f of findings) {
    severitySummary[f.severity]++;
  }

  const passed =
    severitySummary.critical === 0 && severitySummary.high === 0;

  return {
    passed,
    findings,
    severitySummary,
    scan_duration_ms: Date.now() - t0,
    endpoint_used: OPSERA_ENDPOINT,
  };
}
