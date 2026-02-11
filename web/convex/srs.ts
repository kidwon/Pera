import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Calculates the next review schedule using a modified SM-2 algorithm.
 * 
 * Ratings:
 * 1: Again (Fail) - Reset interval, ease decreases slightly.
 * 2: Hard (Pass) - Interval * 1.2, ease decreases.
 * 3: Good (Pass) - Interval * Ease, ease unchanged.
 * 4: Easy (Pass) - Interval * Ease * 1.3, ease increases.
 */
function calculateNextReview(
    rating: number, // 1, 2, 3, 4
    lastInterval: number,
    lastEase: number,
    lastStage: number
) {
    let interval = lastInterval;
    let ease = lastEase;
    let stage = lastStage;

    if (rating === 1) {
        // Again: Reset
        stage = 0;
        interval = 1; // 1 day
        ease = Math.max(1.3, ease - 0.2); // Penalty
    } else {
        // Pass
        if (stage === 0) {
            interval = 1;
        } else if (stage === 1) {
            interval = 6;
        } else {
            // Stage 2+
            let modifier = ease;
            if (rating === 2) modifier = 1.2; // Hard: reduced text_multiplier
            if (rating === 4) modifier = ease * 1.3; // Easy: bonus multiplier

            interval = Math.ceil(interval * modifier);
        }

        stage++;

        // Ease adjustment
        if (rating === 2) ease = Math.max(1.3, ease - 0.15);
        if (rating === 4) ease += 0.15;
        // Good (3) doesn't change ease in this simple version, or we can use the full formula
    }

    // Convert days to ms
    const nextReview = Date.now() + interval * 24 * 60 * 60 * 1000;

    return {
        interval,
        ease,
        stage,
        nextReview,
    };
}

export const review = mutation({
    args: {
        cardId: v.id("cards"),
        rating: v.number(), // 1: Again, 2: Hard, 3: Good, 4: Easy
    },
    handler: async (ctx, args) => {
        const card = await ctx.db.get(args.cardId);
        if (!card) throw new Error("Card not found");

        const result = calculateNextReview(
            args.rating,
            card.interval,
            card.ease_factor,
            card.srs_stage
        );

        await ctx.db.patch(args.cardId, {
            srs_stage: result.stage,
            next_review: result.nextReview,
            interval: result.interval,
            ease_factor: result.ease,
        });

        return result;
    },
});
