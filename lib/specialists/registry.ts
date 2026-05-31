import {
  tensorlakeExec,
  TENSORLAKE_EXEC_CONFIG,
} from "./tensorlake-exec";
import { codexWriter, CODEX_WRITER_CONFIG } from "./codex-writer";
import { devinEngineer, DEVIN_ENGINEER_CONFIG } from "./devin-engineer";
import { vercelV0, VERCEL_V0_CONFIG } from "./vercel-v0";
import {
  insforgeBackend,
  INSFORGE_BACKEND_CONFIG,
} from "./insforge-backend";
import { asideBrowser, ASIDE_BROWSER_CONFIG } from "./aside-browser";
import {
  convexRealtime,
  CONVEX_REALTIME_CONFIG,
} from "./convex-realtime";
import { rtrvrWeb, RTRVR_WEB_CONFIG } from "./rtrvr-web";
import { TENSORLAKE_A2A_CONFIG } from "./tensorlake-a2a";
import { DEVIN_A2A_CONFIG } from "./devin-a2a";
import { CONVEX_A2A_CONFIG } from "./convex-a2a";
import { makeMcpForwardingSpecialist } from "./mcp-forwarding";
import { makeA2aForwardingSpecialist } from "./a2a-forwarding";
import { makeMockSpecialist } from "./base";
import { makeDevinMcpBridgeSpecialist } from "./devin-bridge";
import type { SpecialistConfig, SpecialistRunner, AgentId } from "../types";
export { toPublicTier } from "./tiers";

/**
 * Seed A2A specialist that round-trips to Agora's own /api/a2a/market gateway.
 * Proves the outbound A2A runner works without depending on an external service.
 */
const AGORA_LOOPBACK_BASE =
  process.env.AGORA_LOOPBACK_BASE ?? "http://localhost:3000";

const AGORA_LOOPBACK_A2A_CONFIG: SpecialistConfig = {
  agent_id: "agora-loopback-a2a",
  display_name: "Agora Market (A2A loopback)",
  sponsor: "Agora",
  capabilities: ["task routing", "specialist dispatch", "market discovery"],
  system_prompt:
    "You are the Agora market gateway, reachable via the A2A protocol. You route tasks to registered specialists.",
  cost_baseline: 0.05,
  starting_reputation: 80,
  one_liner: "Routes tasks through the Agora market via A2A.",
  tier: "a2a",
  a2a_endpoint: `${AGORA_LOOPBACK_BASE}/api/a2a/market`,
};

/**
 * Applied Intelligence Hackathon specialist roster.
 * Live sponsors: rtrvr.ai (web-intel), InsForge (backend), plus Opsera (judge gate in auctions.ts).
 */
export const SPECIALISTS: SpecialistConfig[] = [
  RTRVR_WEB_CONFIG,
  INSFORGE_BACKEND_CONFIG,
  TENSORLAKE_EXEC_CONFIG,
  CODEX_WRITER_CONFIG,
  DEVIN_ENGINEER_CONFIG,
  VERCEL_V0_CONFIG,
  ASIDE_BROWSER_CONFIG,
  CONVEX_REALTIME_CONFIG,
  AGORA_LOOPBACK_A2A_CONFIG,
  // External A2A specialists — registered when their env vars are present.
  TENSORLAKE_A2A_CONFIG,
  DEVIN_A2A_CONFIG,
  CONVEX_A2A_CONFIG,
].filter((s) => s.tier !== "disabled");

export const SPECIALIST_RUNNERS: Partial<Record<AgentId, SpecialistRunner>> = {
  "rtrvr-web": rtrvrWeb,
  "tensorlake-exec": tensorlakeExec,
  "codex-writer": codexWriter,
  "devin-engineer": devinEngineer,
  "vercel-v0": vercelV0,
  "insforge-backend": insforgeBackend,
  "aside-browser": asideBrowser,
  "convex-realtime": convexRealtime,
};

// Warn once at module load for every specialist that is explicitly mocked.
for (const cfg of SPECIALISTS) {
  if (cfg.tier === "mock") {
    console.warn(
      `[agora] specialist "${cfg.agent_id}" (${cfg.sponsor}) is running as tier:"mock" — no live tools will be called.`,
    );
  }
}

/**
 * Discovered specialists registered at runtime. Persisted in Convex so they
 * survive across requests; this Map is a per-process cache hydrated on demand.
 */
const DISCOVERED: Map<string, SpecialistConfig> = new Map();

export function registerDiscoveredSpecialist(config: SpecialistConfig) {
  DISCOVERED.set(config.agent_id, { ...config, discovered: true });
}

export function getDiscoveredSpecialists(): SpecialistConfig[] {
  return Array.from(DISCOVERED.values());
}

export function getAllSpecialists(): SpecialistConfig[] {
  return [...SPECIALISTS, ...getDiscoveredSpecialists()];
}

/**
 * Tier-driven runner factory.
 */
function buildRunner(cfg: SpecialistConfig): SpecialistRunner {
  switch (cfg.tier) {
    case "real": {
      const runner = SPECIALIST_RUNNERS[cfg.agent_id];
      if (!runner) {
        throw new Error(
          `Specialist "${cfg.agent_id}" has tier:"real" but no hand-written runner is registered in SPECIALIST_RUNNERS. Add one or change the tier.`,
        );
      }
      return runner;
    }

    case "mcp-forwarding": {
      if (!cfg.mcp_endpoint) {
        throw new Error(
          `Specialist "${cfg.agent_id}" has tier:"mcp-forwarding" but mcp_endpoint is not set.`,
        );
      }
      if (cfg.mcp_api_key_env && !process.env[cfg.mcp_api_key_env]) {
        const missingKey = cfg.mcp_api_key_env;
        const agentId = cfg.agent_id;
        console.warn(
          `[agora] specialist "${agentId}": env var ${missingKey} is not set — runner will decline all bids loudly.`,
        );
        return {
          config: cfg,
          async bid() {
            return {
              decline: true,
              reason: `${agentId} requires ${missingKey} to be set; the env var is missing so this specialist cannot execute tasks.`,
            };
          },
          async execute() {
            throw new Error(
              `${agentId} cannot execute: ${missingKey} is not configured.`,
            );
          },
        };
      }
      return makeMcpForwardingSpecialist(cfg);
    }

    case "a2a": {
      if (!cfg.a2a_endpoint) {
        throw new Error(
          `Specialist "${cfg.agent_id}" has tier:"a2a" but a2a_endpoint is not set.`,
        );
      }
      return makeA2aForwardingSpecialist(cfg);
    }

    case "a2a-bridge": {
      if (cfg.agent_id === "devin-engineer") {
        return makeDevinMcpBridgeSpecialist(cfg);
      }
      throw new Error(
        `Specialist "${cfg.agent_id}" has tier:"a2a-bridge" but no bridge runner is registered.`,
      );
    }

    case "mock": {
      return makeMockSpecialist(cfg);
    }

    case "disabled": {
      throw new Error(
        `Specialist "${cfg.agent_id}" is disabled and should never be dispatched.`,
      );
    }

    default: {
      const exhaustive: never = cfg.tier;
      throw new Error(`Unknown tier "${exhaustive}" on specialist "${cfg.agent_id}"`);
    }
  }
}

export function getRunner(agent_id: AgentId): SpecialistRunner {
  const runner = SPECIALIST_RUNNERS[agent_id];
  if (runner) return runner;
  const cfg =
    SPECIALISTS.find((s) => s.agent_id === agent_id) ?? DISCOVERED.get(agent_id);
  if (!cfg) throw new Error(`No specialist runner registered for ${agent_id}`);
  return buildRunner(cfg);
}
