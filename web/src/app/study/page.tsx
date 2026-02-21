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
    const mode = searchParams.get("mode") || "random"; // 'random' | 'sequential'
    const filterMode = searchParams.get("filterMode") === "true" ? true : undefined;

    // Convex calls (conditionally used)
    const rawDueCards = useQuery(api.cards.getDueCards, { limit: 100, level, filterMode });
    const myCards = useQuery(api.cards.getAllCards, source === "global" ? {} : "skip");
    const reviewCard = useMutation(api.srs.review);
    const addCard = useMutation(api.cards.addCard);
    const { speak } = useTTS();

    const [cards, setCards] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [ratedMap, setRatedMap] = useState<Map<string, 1 | 3>>(new Map()); // card._id -> rating
    const [sessionDone, setSessionDone] = useState(false);
    const [addedCardIds, setAddedCardIds] = useState<Set<string>>(new Set());

    // Pre-populate addedCardIds from Convex (persists across refreshes)
    useEffect(() => {
        if (myCards) {
            const entSeqSet = new Set(myCards.map((c: any) => String(c.ent_seq)));
            setAddedCardIds(entSeqSet);
        }
    }, [myCards]);

    // Global fetch state
    const [globalCards, setGlobalCards] = useState<any[] | null>(null);

    const [visibleLanguages, setVisibleLanguages] = useState<string[]>(['eng', 'cn']);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('visibleLanguages');
            if (saved) {
                try { setVisibleLanguages(JSON.parse(saved)); } catch (e) { }
            }
        }
    }, []);

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
                        // Shuffle only in random mode
                        const ordered = mode === 'sequential'
                            ? mappedCards
                            : mappedCards.sort(() => Math.random() - 0.5);
                        setGlobalCards(ordered);
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
            setCards(activeCards);
            if (mode === 'sequential' && level && source === 'global') {
                const saved = parseInt(localStorage.getItem(`libraryProgress_${level}`) || '0', 10);
                setCurrentIndex(Math.min(saved, activeCards.length - 1));
            } else if (source !== 'global') {
                // SRS: don't reset index if we already have cards (reactive re-query)
                setCurrentIndex(prev => (cards.length === 0 ? 0 : prev));
            } else {
                setCurrentIndex(0);
            }
        }
    }, [activeCards]);

    // Pure navigation — swipe left past last card triggers completion in SRS mode
    const handleSwipe = async (direction: "left" | "right") => {
        if (direction === "right") {
            setCurrentIndex(prev => Math.max(0, prev - 1));
            return;
        }
        // Left swipe
        if (source !== 'global' && currentIndex >= cards.length - 1) {
            // At last SRS card: auto-rate unrated as "got it" then complete
            const unrated = cards.filter(c => !ratedMap.has(c._id));
            await Promise.all(unrated.map(c => reviewCard({ cardId: c._id, rating: 3 })));
            setRatedMap(prev => {
                const next = new Map(prev);
                unrated.forEach(c => next.set(c._id, 3));
                return next;
            });
            setSessionDone(true);
            return;
        }
        if (currentIndex >= cards.length - 1) return; // global mode: stop at end
        const next = currentIndex + 1;
        setCurrentIndex(next);
        if (source === 'global' && mode === 'sequential' && level) {
            localStorage.setItem(`libraryProgress_${level}`, String(next));
        }
    };

    // SRS rating: allow re-rating at any time
    const handleRate = async (card: any, rating: 1 | 3) => {
        try {
            await reviewCard({ cardId: card._id, rating });
            setRatedMap(prev => new Map(prev).set(card._id, rating));
            // Auto-advance only on first rating (not re-rating)
            if (!ratedMap.has(card._id) && currentIndex < cards.length - 1) {
                setCurrentIndex(prev => prev + 1);
            }
        } catch (e) {
            console.error('Failed to rate card:', e);
        }
    };

    const handleAddToMyCards = async (card: any) => {
        const key = String(card.ent_seq);
        if (addedCardIds.has(key)) return;
        try {
            await addCard({
                ent_seq: card.ent_seq,
                kanji: card.kanji,
                reading: card.reading,
                meanings: card.meanings,
                pitch: card.pitch,
                meaningIndex: 0,
                jlptLevel: card.jlptLevel,
            });
            setAddedCardIds(prev => new Set(prev).add(key));
        } catch (e) {
            console.error("Failed to add card:", e);
        }
    };

    if (!activeCards) {
        return <div className="flex items-center justify-center min-h-screen">...</div>;
    }

    // Show completion: either no cards due, OR sessionDone triggered
    const studyComplete = cards.length === 0 || sessionDone;

    if (studyComplete) {
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

    const currentCard = cards[currentIndex];
    if (!currentCard) return <div className="flex items-center justify-center min-h-screen">...</div>;

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-muted/20 overflow-hidden relative">
            <div className="absolute top-4 left-4 flex flex-wrap gap-2 z-10 max-w-[80vw]">
                <Button
                    variant="outline"
                    size="sm"
                    className="bg-background/80 backdrop-blur-sm"
                    onClick={() => source === "global" ? router.push("/search?tab=library") : router.back()}
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
            <div className="absolute top-4 right-4 text-sm text-muted-foreground bg-background/50 px-2 py-1 rounded-md backdrop-blur-sm z-10 hidden sm:flex items-center gap-2">
                {source === "global" && level && (
                    <span className="font-medium text-foreground">{t.libraryTab} {level}</span>
                )}
                <span>{currentIndex + 1} / {cards.length}</span>
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
                    <div className="flex flex-col w-full h-full relative">
                        {/* Scrollable Content Area */}
                        <div className="flex-1 overflow-y-auto overflow-x-hidden w-full px-2 py-4 space-y-4 flex flex-col items-center">
                            {currentCard.kanji && currentCard.reading && (
                                <div className="text-xl text-muted-foreground shrink-0">{currentCard.reading}</div>
                            )}
                            <div className="text-lg text-left w-full space-y-2">
                                {currentCard.meanings?.length > 0 ? (
                                    currentCard.meanings.map((m: any, idx: number) => {
                                        const visibleGlosses = [];

                                        for (const [lang, translations] of Object.entries(m.glosses || {})) {
                                            if (visibleLanguages.includes(lang)) {
                                                const langPrefix = lang === 'eng' ? null : `[${lang.toUpperCase()}]`;
                                                visibleGlosses.push(
                                                    <span key={lang}>
                                                        {langPrefix && <span className="font-medium text-[10.5px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground mr-1.5">{langPrefix}</span>}
                                                        {(translations as string[]).join("; ")}
                                                    </span>
                                                );
                                            }
                                        }

                                        if (m.gloss && (!m.glosses || Object.keys(m.glosses).length === 0) && visibleLanguages.includes("eng")) {
                                            visibleGlosses.push(<span key="eng-legacy">{m.gloss}</span>);
                                        }

                                        if (visibleGlosses.length === 0 && (!m.gloss_cn || !visibleLanguages.includes("cn"))) return null;

                                        return (
                                            <div key={idx} className="bg-background/40 p-3 rounded-md space-y-1">
                                                {m.gloss_cn && visibleLanguages.includes("cn") && (
                                                    <div className="font-bold text-primary text-xl mb-1">{m.gloss_cn}</div>
                                                )}
                                                <div className="text-muted-foreground leading-relaxed flex flex-wrap items-center gap-1.5">
                                                    <span className="font-medium mr-1">{idx + 1}.</span>
                                                    {m.tags && Array.isArray(m.tags) && m.tags.map((tag: string) => {
                                                        const isPos = tag.includes('noun') || tag.includes('verb') || tag.includes('adjective') || tag.includes('adverb');
                                                        const badgeVariant = isPos ? "bg-muted/60 text-muted-foreground" : "bg-primary/10 text-primary border-primary/20";
                                                        const translatedTag = t.tags?.[tag.toLowerCase() as keyof typeof t.tags] || tag;
                                                        return (
                                                            <span key={tag} className={`px-1.5 py-0.5 text-[10.5px] font-medium rounded border uppercase tracking-wide ${badgeVariant}`}>
                                                                {translatedTag}
                                                            </span>
                                                        );
                                                    })}
                                                    {visibleGlosses.map((g, gi) => (
                                                        <span key={gi}>
                                                            {g}
                                                            {gi < visibleGlosses.length - 1 ? <span className="mx-1.5 text-muted-foreground/40">·</span> : ""}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="text-center text-muted-foreground">No meanings available</div>
                                )}
                            </div>
                            {currentCard.meanings?.some((m: any) => m.examples?.length > 0) && (
                                <div className="mt-4 text-sm text-left w-full bg-background/50 p-3 rounded-md shrink-0">
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
                        </div>
                        {/* Fixed bottom bar: SRS rating buttons (SRS mode only) + video button */}
                        <div className="shrink-0 border-t border-border/30" onClick={(e) => e.stopPropagation()}>
                            {!currentCard.isGlobal && (
                                <div className="flex gap-2 justify-center pt-2 pb-1 px-2">
                                    <Button
                                        variant={ratedMap.get(currentCard._id) === 1 ? "destructive" : "outline"}
                                        size="sm"
                                        className="flex-1 gap-1 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                                        onClick={() => handleRate(currentCard, 1)}
                                    >
                                        ✗ {t.again}
                                    </Button>
                                    <Button
                                        variant={ratedMap.get(currentCard._id) === 3 ? "default" : "outline"}
                                        size="sm"
                                        className="flex-1 gap-1 text-green-600 hover:text-green-600 border-green-600/30 hover:bg-green-600/10"
                                        onClick={() => handleRate(currentCard, 3)}
                                    >
                                        ✓ {t.good}
                                    </Button>
                                </div>
                            )}
                            <div className="flex justify-center pt-1 pb-1">
                                <VideoDrawer query={currentCard.kanji || currentCard.reading || ""} />
                            </div>
                        </div>

                        {/* Fixed Audio Button at Bottom Right */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute bottom-0 right-0 rounded-full hover:bg-muted bg-background/80 backdrop-blur-sm shadow-sm border border-border/50"
                            onClick={(e) => {
                                e.stopPropagation();
                                speak(currentCard.reading || currentCard.kanji || "");
                            }}
                        >
                            <Volume2 className="h-5 w-5 text-muted-foreground" />
                        </Button>
                    </div>
                }
                onSwipe={handleSwipe}
            />

            {/* Add to My Cards button (global cards only) */}
            {currentCard?.isGlobal && (
                <div className="mt-4" onClick={(e) => e.stopPropagation()}>
                    <Button
                        variant={addedCardIds.has(String(currentCard.ent_seq)) ? "secondary" : "default"}
                        size="sm"
                        disabled={addedCardIds.has(String(currentCard.ent_seq))}
                        onClick={() => handleAddToMyCards(currentCard)}
                        className="shadow-sm gap-1.5"
                    >
                        {addedCardIds.has(String(currentCard.ent_seq)) ? `✓ ${t.added}` : `+ ${t.addToMyCards || 'Add to My Cards'}`}
                    </Button>
                </div>
            )}

            {/* Helper text */}
            <div className="mt-4 text-sm text-muted-foreground">
                {t.prevCard || '上一张'} → &nbsp;|&nbsp; ← {t.nextCard || '下一张'}
            </div>
        </div>
    );
}

export default function StudyPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">...</div>}>
            <StudyContent />
        </Suspense>
    );
}
