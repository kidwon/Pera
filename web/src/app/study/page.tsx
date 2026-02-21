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
    const source = searchParams.get("source");
    const filterMode = searchParams.get("filterMode") === "true" ? true : undefined;

    // Convex calls (conditionally used)
    const rawDueCards = useQuery(api.cards.getDueCards, { limit: 10, level, filterMode });
    const reviewCard = useMutation(api.srs.review);
    const addCard = useMutation(api.cards.addCard);
    const { speak } = useTTS();

    const [cards, setCards] = useState<any[]>([]);
    const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());

    // Global fetch state
    const [globalCards, setGlobalCards] = useState<any[] | null>(null);

    useEffect(() => {
        if (source === "global" && level) {
            const fetchGlobal = async () => {
                try {
                    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8082";
                    const res = await fetch(`${baseUrl}/api/dictionary/level?level=${level}`);
                    if (res.ok) {
                        const data = await res.json();
                        // Map the Ktor payload to look similar enough to a Convex card for our UI
                        const mappedCards = data.map((entry: any, index: number) => ({
                            _id: `global_${entry.ent_seq}_${index}`,
                            ent_seq: entry.ent_seq,
                            kanji: entry.kanji,
                            reading: entry.reading,
                            meanings: entry.meanings,
                            pitch: entry.pitch,
                            jlptLevel: entry.jlptLevel,
                            isGlobal: true
                        }));
                        // Shuffle cards for a better study experience
                        setGlobalCards(mappedCards.sort(() => Math.random() - 0.5));
                    } else {
                        setGlobalCards([]);
                    }
                } catch (e) {
                    console.error("Failed to fetch global library:", e);
                    setGlobalCards([]);
                }
            };
            fetchGlobal();
        }
    }, [source, level]);

    // Determine the active data source
    const activeCards = source === "global" ? globalCards : rawDueCards;

    useEffect(() => {
        if (activeCards) {
            // Filter out cards that we have already reviewed in this session
            setCards(activeCards.filter((c: any) => !reviewedIds.has(c._id)));
        }
    }, [activeCards, reviewedIds]);

    const handleSwipe = async (direction: "left" | "right") => {
        if (cards.length === 0) return;

        const currentCard = cards[0];
        const rating = direction === "right" ? 3 : 1; // Right = Good (3), Left = Again (1)

        // Optimistic update: Remove card from stack immediately and track its ID
        setReviewedIds(prev => new Set(prev).add(currentCard._id));
        setCards(prevCards => prevCards.slice(1));

        if (currentCard.isGlobal) {
            // Global Mode Logic
            // If they swipe left (rating 1 == Again/Hard), it means they don't know it well. 
            // Automatically silently save it to their Convex collection!
            if (rating === 1) {
                try {
                    await addCard({
                        ent_seq: currentCard.ent_seq,
                        kanji: currentCard.kanji,
                        reading: currentCard.reading,
                        meanings: currentCard.meanings,
                        pitch: currentCard.pitch,
                        meaningIndex: 0, // Assume primary meaning
                        jlptLevel: currentCard.jlptLevel,
                    });
                    console.log(`Saved ${currentCard.kanji || currentCard.reading} from global library to your cards context.`);
                } catch (e) {
                    console.error("Failed to auto-save global card:", e);
                }
            }
        } else {
            // Standard SRS Mode Logic
            await reviewCard({ cardId: currentCard._id, rating });
        }
    };

    if (!activeCards) {
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
                        <div className="text-lg text-left w-full space-y-2 px-4">
                            {currentCard.meanings?.length > 0 ? (
                                currentCard.meanings.map((m: any, idx: number) => {
                                    const enStr = (m.glosses && m.glosses.eng ? m.glosses.eng.join("; ") : m.gloss) || "";
                                    return (
                                        <div key={idx} className="bg-background/40 p-2 rounded-md">
                                            {m.gloss_cn && <div className="font-bold text-primary text-xl">{m.gloss_cn}</div>}
                                            {enStr && <div className="text-muted-foreground">{idx + 1}. {enStr}</div>}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-center text-muted-foreground">No meanings available</div>
                            )}
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
