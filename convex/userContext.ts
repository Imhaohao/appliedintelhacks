"use node";

/**
 * Lets the user fill in the context gap when enrichment returned nothing.
 * Appends the user's text to the task's prompt addendum and resumes the auction.
 */

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { BusinessContext, RepoContext, RoutingContext } from "../lib/orchestration-context";

const BID_WINDOW_MS = 15_000;

export const provide = action({
  args: {
    task_id: v.id("tasks"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const trimmed = args.text.trim();
    if (!trimmed) {
      throw new Error("Context cannot be empty.");
    }

    const task = await ctx.runQuery(internal.tasks._get, {
      task_id: args.task_id,
    });
    const stub = await ctx.runQuery(internal.taskContexts._latestForTask, {
      task_id: args.task_id,
    });
    if (!stub) {
      throw new Error("Task context not found.");
    }

    const merged = `${stub.prompt_addendum}\n\nUser-provided context:\n${trimmed}`;

    await ctx.runMutation(internal.taskContexts._insert, {
      task_id: args.task_id,
      version: stub.version,
      business: stub.business as BusinessContext,
      repo: stub.repo as RepoContext,
      routing: stub.routing as RoutingContext,
      prompt_addendum: merged,
    });

    await ctx.runMutation(internal.lifecycle.log, {
      task_id: args.task_id,
      event_type: "context_user_provided",
      payload: {
        char_count: trimmed.length,
        preview: trimmed.slice(0, 300),
      },
    });

    // Persist to Tigris for durability.
    try {
      const { putContextBlob } = await import("../lib/tigris");
      await putContextBlob(args.task_id, {
        task_id: args.task_id,
        task_type: task.task_type,
        user_provided: trimmed,
        prompt: task.prompt,
        merged,
        persisted_at: Date.now(),
      });
    } catch { /* non-fatal */ }

    // Resume the pipeline.
    const closes_at = Date.now() + BID_WINDOW_MS;
    await ctx.runMutation(internal.tasks._setBidWindow, {
      task_id: args.task_id,
      bid_window_closes_at: closes_at,
    });
    await ctx.scheduler.runAfter(0, internal.auctions.solicitBids, {
      task_id: args.task_id,
    });
    await ctx.scheduler.runAfter(BID_WINDOW_MS, internal.auctions.resolve, {
      task_id: args.task_id,
    });
  },
});
