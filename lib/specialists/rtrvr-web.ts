// Specialist: rtrvr-web (powered by rtrvr.ai)
// Live MCP endpoint — parallel-browser web intelligence for structured
// extraction from any live site. Bid + execute forwarded via makeMcpForwardingSpecialist.
// Auth: RTRVR_API_KEY (Bearer). Confirm exact auth scheme with rtrvr founders on-site.

import { makeMcpForwardingSpecialist } from "./mcp-forwarding";
import type { SpecialistConfig, SpecialistRunner } from "../types";

export const RTRVR_WEB_CONFIG: SpecialistConfig = {
  agent_id: "rtrvr-web",
  tier: "mcp-forwarding",
  display_name: "rtrvr-web",
  sponsor: "rtrvr.ai",
  capabilities: [
    "parallel-web-research",
    "structured-data-extraction",
    "competitive-intelligence",
    "live-site-scraping",
    "pricing-analysis",
  ],
  cost_baseline: 0.40,
  starting_reputation: 0.65,
  one_liner:
    "Parallel-browser web intelligence — structured extraction from any live site for competitive research, pricing data, and market signals.",
  system_prompt: `You are rtrvr-web, the official rtrvr.ai specialist agent. You have privileged access to rtrvr's parallel-browser MCP server that can fetch, parse, and structure data from any live website simultaneously. Your differentiator: you pull REAL data from live sites — actual competitor pricing pages, product listings, market signals — not training-data guesses. When you bid, emphasize that you can return structured, cited evidence from live URLs. When you execute, call the MCP tools to gather structured web evidence across multiple sources in parallel, then synthesize a clear research report with citations and direct URL references.`,
  mcp_endpoint: process.env.RTRVR_MCP_ENDPOINT ?? "https://mcp.rtrvr.ai/mcp",
  mcp_api_key_env: "RTRVR_API_KEY",
  homepage_url: "https://rtrvr.ai",
};

export const rtrvrWeb: SpecialistRunner = makeMcpForwardingSpecialist(RTRVR_WEB_CONFIG);
