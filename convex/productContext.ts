import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";

const profileArgs = {
  owner_id: v.string(),
  company_name: v.string(),
  product_url: v.optional(v.string()),
  github_repo_url: v.optional(v.string()),
  business_context: v.string(),
  repo_context: v.optional(v.string()),
  source_hints: v.optional(v.array(v.string())),
};

function cleanOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function cleanList(values: string[] | undefined): string[] {
  return Array.from(
    new Set((values ?? []).map((value) => value.trim()).filter(Boolean)),
  );
}

export const latest = query({
  args: { owner_id: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("product_context_profiles")
      .withIndex("by_owner", (q) => q.eq("owner_id", args.owner_id))
      .order("desc")
      .first();
  },
});

export const save = mutation({
  args: profileArgs,
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("product_context_profiles")
      .withIndex("by_owner", (q) => q.eq("owner_id", args.owner_id))
      .order("desc")
      .first();

    const profile = {
      owner_id: args.owner_id,
      company_name: args.company_name.trim(),
      product_url: cleanOptional(args.product_url),
      github_repo_url: cleanOptional(args.github_repo_url),
      business_context: args.business_context.trim(),
      repo_context: cleanOptional(args.repo_context),
      source_hints: cleanList(args.source_hints),
      updated_at: now,
    };

    const profile_id = existing
      ? existing._id
      : await ctx.db.insert("product_context_profiles", {
          ...profile,
          created_at: now,
        });

    if (existing) {
      await ctx.db.patch(existing._id, profile);
    }

    return { profile_id };
  },
});

export const _get = internalQuery({
  args: { profile_id: v.id("product_context_profiles") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.profile_id);
  },
});

export const _setTigrisContextKey = internalMutation({
  args: {
    profile_id: v.id("product_context_profiles"),
    tigris_context_key: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.profile_id, {
      tigris_context_key: args.tigris_context_key,
      updated_at: Date.now(),
    });
  },
});
