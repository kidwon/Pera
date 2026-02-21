"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Flashcard } from "@/components/Flashcard";
import { Button } from "@/components/ui/button";
import { Volume2 } from "lucide-react";
import { useTTS } from "@/hooks/useTTS";
import { VideoDrawer } from "@/components/VideoDrawer";
import { useLanguage } from "@/app/LanguageProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

function StudyContent() {
    const { t } = useLanguage();
    const searchParams = useSearchParams();
    const router = useRouter();
    const level = searchParams.get("level") || undefined;
    const filterMode = searchParams.get("filterMode") === "true" ? true : undefined;

    const dueCards = useQuery(api.cards.getDueCards, { limit: 10, level, filterMode });
    const reviewCard = useMutation(api.srs.review);
    const { speak } = useTTS();

    const [cards, setCards] = useState<any[]>([]);
    const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (dueCards) {
            // Filter out cards that we have already reviewed in this session
            setCards(dueCards.filter((c: any) => !reviewedIds.has(c._id)));
        }
    }, [dueCards, reviewedIds]);

    const handleSwipe = async (direction: "left" | "right") => {
        if (cards.length === 0) return;

        const currentCard = cards[0];
        const rating = direction === "right" ? 3 : 1; // Right = Good (3), Left = Again (1)

        // Optimistic update: Remove card from stack immediately and track its ID
        setReviewedIds(prev => new Set(prev).add(currentCard._id));
        setCards(prevCards => prevCards.slice(1));

        // Call backend
        await reviewCard({ cardId: currentCard._id, rating });

        // If "Again", maybe re-queue it at the end? 
        // For now, simpler to just proceed.
    };

    if (!dueCards) {
        return <div className="flex items-center justify-center min-h-screen">...</div>;
    }

    if (cards.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted/20">
                <div className="text-center space-y-6">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                        {t.studyComplete}
                    </h1>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                        <Button
                            variant="default"
                            size="lg"
                            className="shadow-sm"
                            onClick={() => window.location.href = "/search"}
                        >
                            {t.backToSearch}
                        </Button>
                        <Button
                            variant="secondary"
                            size="lg"
                            className="shadow-sm"
                            onClick={() => window.location.href = "/search?tab=myCards"}
                        >
                            {t.backToMyCards}
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    const currentCard = cards[0];

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-muted/20 overflow-hidden relative">
            <div className="absolute top-4 left-4 flex flex-wrap gap-2 z-10 max-w-[80vw]">
                <Button
                    variant="outline"
                    size="sm"
                    className="bg-background/80 backdrop-blur-sm"
                    onClick={() => router.back()}
                >
                    &larr; {t.back}
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    className="bg-background/80 backdrop-blur-sm hidden sm:flex"
                    onClick={() => window.location.href = "/search"}
                >
                    {t.searchTab}
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    className="bg-background/80 backdrop-blur-sm hidden sm:flex"
                    onClick={() => window.location.href = "/search?tab=myCards"}
                >
                    {t.myCardsTab}
                </Button>
                <LanguageSwitcher />
            </div>
            <div className="absolute top-4 right-4 text-sm text-muted-foreground bg-background/50 px-2 py-1 rounded-md backdrop-blur-sm z-10 hidden sm:block">
                {cards.length} {t.appName}
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
                {t.appName}: {t.easy} (&rarr;) | {t.again} (&larr;)
            </div >
        </div >
    );
}

export default function StudyPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">...</div>}>
            <StudyContent />
        </Suspense>
    );
}
