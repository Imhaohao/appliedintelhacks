"use node";

/**
 * Pre-bidding enrichment phase.
 *
 * Runs immediately after tasks.post. Persists the synthetic context stub to
 * Tigris for durable storage, then schedules the auction.
 *
 * The Nia + Hyperspell enrichment calls from the prior Nozomio build have been
 * removed. Context is now persisted on Tigris (the Applied Intel Hackathon
 * sponsor replacing both). The orchestration stub written by tasks.post is
 * still used by specialists as their task context.
 */

import { internalAction, type ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const BID_WINDOW_MS = 15_000;

export const enrichAndStartAuction = internalAction({
  args: { task_id: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.runQuery(internal.tasks._get, {
      task_id: args.task_id,
    });
    const stub = await ctx.runQuery(internal.taskContexts._latestForTask, {
      task_id: args.task_id,
    });

    if (!stub) {
      await ctx.runMutation(internal.lifecycle.log, {
        task_id: args.task_id,
        event_type: "context_enrichment_skipped",
        payload: { reason: "no synthetic stub found" },
      });
      await scheduleAuction(ctx, args.task_id);
      return;
    }

    // Persist context blob to Tigris so it's durable and replayable.
    try {
      const { putContextBlob } = await import("../lib/tigris");
      const result = await putContextBlob(args.task_id, {
        prompt: task.prompt,
        task_type: task.task_type,
        stub,
        persisted_at: Date.now(),
      });
      if (result) {
        await ctx.runMutation(internal.lifecycle.log, {
          task_id: args.task_id,
          event_type: "context_persisted_to_tigris",
          payload: { key: result.key, url: result.url },
        });
      }
    } catch (err) {
      // Non-fatal — proceed to auction even if Tigris write fails.
      await ctx.runMutation(internal.lifecycle.log, {
        task_id: args.task_id,
        event_type: "context_enrichment_skipped",
        payload: {
          reason: `Tigris write failed: ${err instanceof Error ? err.message : String(err)}`,
        },
      });
    }

    await scheduleAuction(ctx, args.task_id);
  },
});

async function scheduleAuction(ctx: ActionCtx, task_id: Id<"tasks">) {
  // Reset bid window so the visible clock starts after enrichment completes.
  const closes_at = Date.now() + BID_WINDOW_MS;
  await ctx.runMutation(internal.tasks._setBidWindow, {
    task_id,
    bid_window_closes_at: closes_at,
  });
  await ctx.scheduler.runAfter(0, internal.auctions.solicitBids, { task_id });
  await ctx.scheduler.runAfter(BID_WINDOW_MS, internal.auctions.resolve, {
    task_id,
  });
}
