import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
// Trigger rebuild 3

export const getDueCards = query({
    args: { limit: v.optional(v.number()) },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();

        // Try to find user by identity
        let user = null;
        if (identity) {
            user = await ctx.db
                .query("users")
                .withIndex("by_token", (q) =>
                    q.eq("tokenIdentifier", identity.tokenIdentifier)
                )
                .unique();
        }

        // Dev fallback: use first user if unauthenticated
        if (!user) {
            console.log("getDueCards: No auth, using first user found.");
            user = await ctx.db.query("users").first();
        }

        if (!user) throw new Error("User not found (please log in or create a user first)");

        const now = Date.now();
        const limit = args.limit ?? 20;

        const cards = await ctx.db
            .query("cards")
            .withIndex("by_user_next_review", (q) =>
                q.eq("userId", user._id).lte("next_review", now)
            )
            .take(limit);

        return cards;
    },
});

export const addCard = mutation({
    args: {
        ent_seq: v.string(),
        kanji: v.optional(v.union(v.string(), v.null())),
        reading: v.optional(v.union(v.string(), v.null())),
        meanings: v.optional(
            v.array(
                v.object({
                    gloss: v.string(),
                    examples: v.optional(
                        v.array(
                            v.object({
                                text: v.string(),
                                text_ja: v.string(),
                            })
                        )
                    ),
                })
            )
        ),
        pitch: v.optional(v.string()),
        meaningIndex: v.optional(v.number()), // Which meaning this card represents
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();

        // Try to find user by identity
        let user = null;
        if (identity) {
            user = await ctx.db
                .query("users")
                .withIndex("by_token", (q) =>
                    q.eq("tokenIdentifier", identity.tokenIdentifier)
                )
                .unique();
        }

        // Dev fallback: use first user if unauthenticated
        if (!user) {
            console.log("addCard: No auth, using first user found.");
            user = await ctx.db.query("users").first();
        }

        if (!user) {
            // Create Dev Admin if absolutely no users exist (edge case)
            console.log("addCard: No users found, creating Dev Admin.");
            const userId = await ctx.db.insert("users", {
                name: "Dev Admin",
                tokenIdentifier: "dev-admin-token",
            });
            user = await ctx.db.get(userId);
        }

        if (!user) throw new Error("User not found (please log in or create a user first)");

        // Check if card already exists (same ent_seq AND meaningIndex)
        const existingCards = await ctx.db
            .query("cards")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .filter((q) => q.eq(q.field("ent_seq"), args.ent_seq))
            .collect();

        // If meaningIndex is provided, check for exact match
        if (args.meaningIndex !== undefined) {
            const existing = existingCards.find(c => c.meaningIndex === args.meaningIndex);
            if (existing) {
                return existing._id;
            }
        } else {
            // Legacy behavior: if no meaningIndex, check if any card exists for this ent_seq
            if (existingCards.length > 0) {
                return existingCards[0]._id;
            }
        }

        return await ctx.db.insert("cards", {
            userId: user._id,
            ent_seq: args.ent_seq,
            kanji: args.kanji ?? null,
            reading: args.reading ?? null,
            meanings: args.meanings ?? [],
            pitch: args.pitch,
            meaningIndex: args.meaningIndex,
            srs_stage: 0,
            next_review: Date.now(),
            interval: 0,
            ease_factor: 2.5,
        });
    },
});

export const seed = mutation({
    args: {
        cards: v.array(
            v.object({
                ent_seq: v.string(),
                kanji: v.union(v.string(), v.null()),
                reading: v.union(v.string(), v.null()),
                meanings: v.array(
                    v.object({
                        gloss: v.string(),
                        examples: v.optional(
                            v.array(
                                v.object({
                                    text: v.string(),
                                    text_ja: v.string(),
                                })
                            )
                        ),
                    })
                ),
                pitch: v.optional(v.union(v.string(), v.null())),
            })
        ),
    },
    handler: async (ctx, args) => {
        // ... (auth logic skipped for brevity in replacement, but kept in file) ...
        const identity = await ctx.auth.getUserIdentity();

        let user = null;
        if (identity) {
            user = await ctx.db
                .query("users")
                .withIndex("by_token", (q) =>
                    q.eq("tokenIdentifier", identity.tokenIdentifier)
                )
                .unique();
        }

        // Dev fallback: use first user if unauthenticated
        if (!user) {
            console.log("Seeding: No auth, using first user found.");
            user = await ctx.db.query("users").first();

            if (!user) {
                console.log("Seeding: No users found, creating Dev Admin.");
                const userId = await ctx.db.insert("users", {
                    name: "Dev Admin",
                    tokenIdentifier: "dev-admin-token",
                });
                user = await ctx.db.get(userId);
            }
        }

        if (!user) throw new Error("User not found (please log in or create a user first)");

        let count = 0;
        for (const card of args.cards) {
            // Check if exists
            const existing = await ctx.db
                .query("cards")
                .withIndex("by_user", (q) => q.eq("userId", user._id))
                .filter((q) => q.eq(q.field("ent_seq"), card.ent_seq))
                .first();

            if (!existing) {
                await ctx.db.insert("cards", {
                    userId: user._id,
                    ent_seq: card.ent_seq,
                    kanji: card.kanji,
                    reading: card.reading,
                    meanings: card.meanings,
                    pitch: card.pitch ?? undefined,
                    srs_stage: 0,
                    next_review: Date.now(),
                    interval: 0,
                    ease_factor: 2.5,
                });
                count++;
            }
        }
        return count;
    },
});

export const deleteAllCards = mutation({
    args: {},
    handler: async (ctx) => {
        const cards = await ctx.db.query("cards").collect();
        for (const card of cards) {
            await ctx.db.delete(card._id);
        }
        return cards.length;
    },
});
