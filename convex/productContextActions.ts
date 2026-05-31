"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

function profileToMemoryText(profile: {
  company_name: string;
  product_url?: string;
  github_repo_url?: string;
  business_context: string;
  repo_context?: string;
  source_hints: string[];
}) {
  return [
    `Company/product: ${profile.company_name}`,
    profile.product_url ? `Product URL: ${profile.product_url}` : undefined,
    profile.github_repo_url ? `GitHub repo: ${profile.github_repo_url}` : undefined,
    "",
    "Business context:",
    profile.business_context,
    "",
    profile.repo_context ? "Repo/source context:" : undefined,
    profile.repo_context,
    profile.source_hints.length > 0 ? "" : undefined,
    profile.source_hints.length > 0 ? "Source hints:" : undefined,
    ...profile.source_hints.map((hint) => `- ${hint}`),
  ]
    .filter((line): line is string => line !== undefined)
    .join("\n");
}

/** Persists the product context blob to Tigris for durable storage. */
export const seedContext = internalAction({
  args: { profile_id: v.id("product_context_profiles") },
  handler: async (ctx, args) => {
    const profile = await ctx.runQuery(internal.productContext._get, {
      profile_id: args.profile_id,
    });
    if (!profile) return;

    try {
      const { putArtifact } = await import("../lib/tigris");
      const key = `product-context/${profile.owner_id}/${profile._id}.json`;
      const result = await putArtifact(
        key,
        JSON.stringify({
          ...profile,
          text: profileToMemoryText(profile),
          persisted_at: Date.now(),
        }),
        "application/json",
      );
      if (result) {
        await ctx.runMutation(internal.productContext._setTigrisContextKey, {
          profile_id: args.profile_id,
          tigris_context_key: result.key,
        });
      }
    } catch (err) {
      console.error("[productContextActions] Tigris context seed failed:", err);
    }
  },
});
