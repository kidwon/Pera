"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Flashcard } from "@/components/Flashcard";
import { Button } from "@/components/ui/button";
import { Volume2 } from "lucide-react";
import { useTTS } from "@/hooks/useTTS";
import { VideoDrawer } from "@/components/VideoDrawer";

export default function StudyPage() {
    const dueCards = useQuery(api.cards.getDueCards, { limit: 10 });
    const reviewCard = useMutation(api.srs.review);
    const { speak } = useTTS();

    const [cards, setCards] = useState<any[]>([]);

    useEffect(() => {
        if (dueCards) {
            setCards(dueCards);
        }
    }, [dueCards]);

    const handleSwipe = async (direction: "left" | "right") => {
        if (cards.length === 0) return;

        const currentCard = cards[0];
        const rating = direction === "right" ? 3 : 1; // Right = Good (3), Left = Again (1)

        // Optimistic update: Remove card from stack immediately
        const nextCards = cards.slice(1);
        setCards(nextCards);

        // Call backend
        await reviewCard({ cardId: currentCard._id, rating });

        // If "Again", maybe re-queue it at the end? 
        // For now, simpler to just proceed.
    };

    if (!dueCards) {
        return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
    }

    if (cards.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4">
                <h1 className="text-2xl font-bold mb-4">All done for now!</h1>
                <Button onClick={() => window.location.reload()}>Refresh</Button>
            </div>
        );
    }

    const currentCard = cards[0];

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-muted/20 overflow-hidden relative">
            <div className="absolute top-4 right-4 text-sm text-muted-foreground">
                {cards.length} cards remaining
            </div>

            <Flashcard
                key={currentCard._id}
                front={
                    <div className="flex flex-col items-center justify-center h-full relative">
                        <div className="text-4xl font-bold mb-4">
                            {currentCard.kanji || currentCard.reading || currentCard.ent_seq}
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute bottom-2 right-2 rounded-full hover:bg-muted"
                            onClick={(e) => {
                                e.stopPropagation();
                                speak(currentCard.reading || currentCard.kanji || "");
                            }}
                        >
                            <Volume2 className="h-6 w-6 text-muted-foreground" />
                        </Button>
                    </div>
                }
                back={
                    <div className="flex flex-col gap-4 relative h-full justify-center">
                        {currentCard.kanji && currentCard.reading && (
                            <div className="text-xl text-muted-foreground">{currentCard.reading}</div>
                        )}
                        <div className="text-lg text-center">
                            {currentCard.meanings?.map((m: any) => m.gloss).join("; ") || "No meanings available"}
                        </div>
                        {currentCard.meanings?.some((m: any) => m.examples?.length > 0) && (
                            <div className="mt-4 text-sm text-left w-full bg-background/50 p-3 rounded-md">
                                {currentCard.meanings.map((m: any, i: number) => (
                                    <div key={i} className="space-y-2">
                                        {m.examples?.map((ex: any, j: number) => (
                                            <div key={j} className="border-l-2 border-primary/30 pl-2">
                                                <div>{ex.text}</div>
                                                <div className="text-xs text-muted-foreground">{ex.text_ja}</div>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="mt-4 flex justify-center" onClick={(e) => e.stopPropagation()}>
                            <VideoDrawer query={currentCard.kanji || currentCard.reading || ""} />
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute bottom-2 right-2 rounded-full hover:bg-muted"
                            onClick={(e) => {
                                e.stopPropagation();
                                speak(currentCard.reading || currentCard.kanji || "");
                            }}
                        >
                            <Volume2 className="h-6 w-6 text-muted-foreground" />
                        </Button>
                    </div>
                }
                onSwipe={handleSwipe}
            />

            {/* Helper text */}
            < div className="mt-12 text-sm text-muted-foreground animate-pulse" >
                Swipe Right & rarr; Good | Swipe Left & rarr; Again
            </div >
        </div >
    );
}
