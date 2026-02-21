import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    users: defineTable({
        name: v.string(),
        tokenIdentifier: v.string(),
    }).index("by_token", ["tokenIdentifier"]),

    cards: defineTable({
        userId: v.id("users"),
        ent_seq: v.string(), // Link to JMdict entry
        kanji: v.union(v.string(), v.null()),
        reading: v.union(v.string(), v.null()),
        meanings: v.array(
            v.object({
                gloss: v.optional(v.string()), // Legacy compatibility
                glosses: v.optional(v.record(v.string(), v.array(v.string()))), // { "eng": ["..."], "ger": ["..."] }
                gloss_cn: v.optional(v.string()), // Chinese definition if available
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
        pitch: v.optional(v.union(v.string(), v.null())), // Pitch accent (0, 1, 2...)
        meaningIndex: v.optional(v.union(v.number(), v.null())), // Which meaning this card represents
        srs_stage: v.number(), // 0-8 (Anki/SM-2 stages)
        next_review: v.number(), // Timestamp
        interval: v.number(), // Days
        ease_factor: v.number(), // Multiplier
        jlptLevel: v.optional(v.union(v.string(), v.null())), // N5, N4, etc.
    })
        .index("by_user", ["userId"])
        .index("by_user_ent_seq", ["userId", "ent_seq"])
        .index("by_user_next_review", ["userId", "next_review"]), // For fetching due cards
});
