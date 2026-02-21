import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Diagnostic Identifier
const VERSION_ID = "DEBUG_V5_STABLE";

// Minimal test mutation - no args, just returns version
export const testPing = mutation({
    args: {},
    handler: async () => {
        console.log(`[PING] Version: ${VERSION_ID}`);
        return `PONG: ${VERSION_ID}`;
    },
});

// Minimal seed with just one hardcoded card - for testing
export const seedOne = mutation({
    args: {},
    handler: async (ctx) => {
        console.log(`[SEED_ONE] Starting. Version: ${VERSION_ID}`);
        let user = await ctx.db.query("users").first();
        if (!user) {
            const userId = await ctx.db.insert("users", {
                name: "Dev Admin",
                tokenIdentifier: "dev-admin-token",
            });
            user = await ctx.db.get(userId);
        }
        if (!user) return "ERROR: no user";

        await ctx.db.insert("cards", {
            userId: user._id,
            ent_seq: "test_" + Date.now(),
            kanji: "テスト",
            reading: "てすと",
            meanings: [{ glosses: { eng: ["test"] } }],
            pitch: "0",
            jlptLevel: "N5",
            meaningIndex: 0,
            srs_stage: 0,
            next_review: Date.now(),
            interval: 0,
            ease_factor: 2.5,
        });
        return `${VERSION_ID} | seedOne OK`;
    },
});

export const getDueCards = query({
    args: {
        limit: v.optional(v.number()),
        level: v.optional(v.union(v.string(), v.null())),
        filterMode: v.optional(v.boolean()), // true = bypass SRS Next Review check
    },
    handler: async (ctx, args) => {
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
        if (!user) {
            user = await ctx.db.query("users").first();
        }
        if (!user) throw new Error("User not found");

        const now = Date.now();
        const limit = args.limit ?? 20;

        let cardsQuery;

        if (args.filterMode) {
            // Burst Review Mode: Fetch ALL cards (either globally ALL or filtered by a specific level), ignoring SRS.
            cardsQuery = ctx.db
                .query("cards")
                .withIndex("by_user", (q) => q.eq("userId", user!._id));

            if (args.level) {
                cardsQuery = cardsQuery.filter((q) => q.eq(q.field("jlptLevel"), args.level));
            }
        } else {
            // SRS Mode: Default behavior, only fetch cards that are due.
            cardsQuery = ctx.db
                .query("cards")
                .withIndex("by_user_next_review", (q) =>
                    q.eq("userId", user!._id).lte("next_review", now)
                );
            // Even in SRS mode, allow level filtering if provided.
            if (args.level) {
                cardsQuery = cardsQuery.filter((q) => q.eq(q.field("jlptLevel"), args.level));
            }
        }

        const cards = await cardsQuery.take(limit);

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
                    gloss: v.optional(v.string()), // Legacy compatibility
                    glosses: v.optional(v.record(v.string(), v.array(v.string()))),
                    gloss_cn: v.optional(v.string()),
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
        pitch: v.optional(v.union(v.string(), v.null())),
        meaningIndex: v.optional(v.union(v.number(), v.null())),
        jlptLevel: v.optional(v.union(v.string(), v.null())),
    },
    handler: async (ctx, args) => {
        let user = await ctx.db.query("users").first();
        if (!user) {
            const userId = await ctx.db.insert("users", {
                name: "Dev Admin",
                tokenIdentifier: "dev-admin-token",
            });
            user = await ctx.db.get(userId);
        }
        if (!user) throw new Error("User not found");

        const existingCards = await ctx.db
            .query("cards")
            .withIndex("by_user", (q) => q.eq("userId", user!._id))
            .filter((q) => q.eq(q.field("ent_seq"), args.ent_seq))
            .collect();

        if (args.meaningIndex !== undefined) {
            const existing = existingCards.find(c => c.meaningIndex === args.meaningIndex);
            if (existing) return existing._id;
        } else if (existingCards.length > 0) {
            return existingCards[0]._id;
        }

        return await ctx.db.insert("cards", {
            userId: user._id,
            ent_seq: args.ent_seq,
            kanji: args.kanji ?? null,
            reading: args.reading ?? null,
            meanings: args.meanings ?? [],
            pitch: args.pitch ?? null,
            meaningIndex: args.meaningIndex ?? 0,
            jlptLevel: args.jlptLevel ?? null,
            srs_stage: 0,
            next_review: Date.now(),
            interval: 0,
            ease_factor: 2.5,
        });
    },
});

export const seed = mutation({
    args: {
        json: v.string(),
    },
    handler: async (ctx, args) => {
        console.log(`[SEED] Mutation Invoked. VERSION: ${VERSION_ID}`);
        try {
            const cardsData = JSON.parse(args.json);
            let user = await ctx.db.query("users").first();
            if (!user) {
                const userId = await ctx.db.insert("users", {
                    name: "Dev Admin",
                    tokenIdentifier: "dev-admin-token",
                });
                user = await ctx.db.get(userId);
            }
            if (!user) throw new Error("No user context");

            let count = 0;
            let errors = 0;
            let skipped = 0;

            for (const rawCard of cardsData) {
                try {
                    const ent_seq = String(rawCard.ent_seq || "");
                    if (!ent_seq) {
                        skipped++;
                        continue;
                    }

                    const existing = await ctx.db
                        .query("cards")
                        .withIndex("by_user_ent_seq", (q) =>
                            q.eq("userId", user!._id).eq("ent_seq", ent_seq)
                        )
                        .first();

                    if (!existing) {
                        await ctx.db.insert("cards", {
                            userId: user._id,
                            ent_seq: ent_seq,
                            kanji: typeof rawCard.kanji === 'string' ? rawCard.kanji : null,
                            reading: typeof rawCard.reading === 'string' ? rawCard.reading : null,
                            meanings: Array.isArray(rawCard.meanings) ? rawCard.meanings.map((m: any) => ({
                                gloss: typeof m.gloss === 'string' ? m.gloss : undefined,
                                glosses: m.glosses || {},
                                gloss_cn: typeof m.gloss_cn === 'string' ? m.gloss_cn : undefined,
                                examples: Array.isArray(m.examples) ? m.examples.map((ex: any) => ({
                                    text: String(ex.text || ""),
                                    text_ja: String(ex.text_ja || ""),
                                })) : [],
                            })) : [],
                            pitch: typeof rawCard.pitch === 'string' ? rawCard.pitch : null,
                            jlptLevel: typeof rawCard.jlptLevel === 'string' ? rawCard.jlptLevel : null,
                            meaningIndex: 0,
                            srs_stage: 0,
                            next_review: Date.now(),
                            interval: 0,
                            ease_factor: 2.5,
                        });
                        count++;
                    } else {
                        skipped++;
                    }
                } catch (cardErr: any) {
                    console.error(`[SEED] Card Error (${rawCard.ent_seq}):`, cardErr.message);
                    errors++;
                }
            }

            return `${VERSION_ID} | Created: ${count}, Skipped: ${skipped}, Errors: ${errors}`;
        } catch (e: any) {
            console.error("[SEED] Fatal Crash:", e);
            return `FATAL: ${e.message}`;
        }
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

export const getAllCards = query({
    args: {},
    handler: async (ctx) => {
        let user = await ctx.db.query("users").first();
        if (!user) return [];
        return await ctx.db
            .query("cards")
            .withIndex("by_user", (q) => q.eq("userId", user!._id))
            .collect();
    },
});

export const removeCard = mutation({
    args: { cardId: v.id("cards") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.cardId);
    },
});
