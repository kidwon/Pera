"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Check, Volume2, Trash2 } from "lucide-react";
import { useTTS } from "@/hooks/useTTS";
import { SimpleDialog } from "@/components/ui/simple-dialog";
import { YouGlishPlayer } from "@/components/YouGlishPlayer";
import { useLanguage } from "@/app/LanguageProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SearchResult {
    ent_seq: string;
    kanji: string | null;
    reading: string | null;
    meanings: {
        gloss: string;
        examples?: {
            text: string;
            text_ja: string;
        }[];
    }[];
    pitch?: string;
}

// Animation variants
const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
};

export default function SearchPage() {
    const { t } = useLanguage();
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
    const [showVideo, setShowVideo] = useState(false);
    const [activeTab, setActiveTab] = useState("search");

    const addCard = useMutation(api.cards.addCard);
    const removeCard = useMutation(api.cards.removeCard);
    const myCards = useQuery(api.cards.getAllCards);
    const { speak } = useTTS();

    // Sync added state with backend data
    const addedKeys = useMemo(() => {
        const keys = new Set<string>();
        if (myCards) {
            myCards.forEach(card => {
                keys.add(`${card.ent_seq}:${card.meaningIndex}`);
            });
        }
        return keys;
    }, [myCards]);

    useEffect(() => {
        const searchDictionary = async () => {
            if (!query.trim()) {
                setResults([]);
                return;
            }

            setLoading(true);
            try {
                const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8082";
                const response = await fetch(`${baseUrl}/api/dictionary/search?q=${encodeURIComponent(query)}`);
                if (response.ok) {
                    const data = await response.json();
                    setResults(data);
                } else {
                    setResults([]);
                }
            } catch (error) {
                console.error("Search failed:", error);
                setResults([]);
            } finally {
                setLoading(false);
            }
        };

        const timeoutId = setTimeout(searchDictionary, 300);
        return () => clearTimeout(timeoutId);
    }, [query]);

    const handleAddMeaning = async (result: SearchResult, meaningIndex: number) => {
        try {
            await addCard({
                ent_seq: result.ent_seq,
                kanji: result.kanji,
                reading: result.reading,
                meanings: [result.meanings[meaningIndex]], // Single meaning
                pitch: result.pitch ?? undefined,
                meaningIndex: meaningIndex,
            });
        } catch (error) {
            console.error("Failed to add card:", error);
            // @ts-ignore
            const errorMessage = error.message || JSON.stringify(error);
            alert(`Failed to add card: ${errorMessage}`);
        }
    };

    const handleRemoveCard = async (cardId: any, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm(t.confirmRemove || "Remove this card?")) {
            try {
                await removeCard({ cardId });
            } catch (error) {
                console.error("Failed to remove card:", error);
            }
        }
    };

    const handleCardClick = (result: SearchResult) => {
        setSelectedResult(result);
        setShowVideo(false); // Reset video state
    };

    const closeDetail = () => {
        setSelectedResult(null);
        setShowVideo(false);
    };

    return (
        <div className="container mx-auto max-w-2xl p-4 min-h-screen pb-20">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-center flex-1 ml-10">{t.appName}</h1>
                <LanguageSwitcher />
            </div>

            <Tabs defaultValue="search" value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="search">{t.searchTab}</TabsTrigger>
                    <TabsTrigger value="myCards">{t.myCardsTab}</TabsTrigger>
                </TabsList>

                <TabsContent value="search" className="mt-0">
                    <div className="sticky top-0 bg-background/95 backdrop-blur py-4 z-10">
                        <Input
                            placeholder={t.searchPlaceholder}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="text-lg h-12"
                            autoFocus
                        />
                    </div>

                    <div className="mt-4 space-y-4">
                        {loading && <div className="text-center text-muted-foreground animate-pulse">...</div>}

                        {!loading && results.length === 0 && query.trim() !== "" && (
                            <div className="text-center text-muted-foreground">{t.noCards}</div>
                        )}

                        {results.map((result) => {
                            const isAdded = addedKeys.has(`${result.ent_seq}:0`);
                            return (
                                <Card
                                    key={result.ent_seq}
                                    className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                                    onClick={() => handleCardClick(result)}
                                >
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-2xl font-bold text-primary">
                                                    {result.kanji || result.reading}
                                                </span>
                                                {result.kanji && result.reading && (
                                                    <span className="text-sm text-muted-foreground">
                                                        ({result.reading}{result.pitch ? ` [${result.pitch}]` : ""})
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    disabled={isAdded}
                                                    className={`h-8 w-8 ${isAdded ? "text-primary opacity-50" : "text-muted-foreground hover:text-primary"}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (!isAdded) {
                                                            handleAddMeaning(result, 0);
                                                        }
                                                    }}
                                                >
                                                    {isAdded ? <Check className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        speak(result.reading || result.kanji || "");
                                                    }}
                                                >
                                                    <Volume2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="text-sm text-muted-foreground line-clamp-2">
                                            {result.meanings.map(m => m.gloss).join("; ")}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </TabsContent>

                <TabsContent value="myCards" className="mt-0">
                    <div className="mt-4 space-y-4">
                        {myCards === undefined && <div className="text-center text-muted-foreground animate-pulse">...</div>}

                        {myCards && myCards.length === 0 && (
                            <div className="text-center py-10 text-muted-foreground">
                                {t.noSavedCards}
                            </div>
                        )}

                        <motion.div
                            variants={containerVariants}
                            initial="hidden"
                            animate="show"
                            className="space-y-4"
                        >
                            <AnimatePresence mode="popLayout">
                                {myCards?.map((card) => (
                                    <motion.div
                                        key={card._id}
                                        variants={itemVariants}
                                        layout
                                        initial="hidden"
                                        animate="show"
                                        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                                    >
                                        <Card
                                            className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer relative group"
                                            onClick={() => handleCardClick(card as any)}
                                        >
                                            <CardContent className="p-4">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xl font-bold text-primary">
                                                            {card.kanji || card.reading}
                                                        </span>
                                                        {card.kanji && card.reading && (
                                                            <span className="text-xs text-muted-foreground">
                                                                ({card.reading})
                                                            </span>
                                                        )}
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive transition-opacity"
                                                        onClick={(e) => handleRemoveCard(card._id, e)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    {card.meanings.map(m => m.gloss).join("; ")}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </motion.div>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Detail View Dialog */}
            {selectedResult && (
                <SimpleDialog
                    isOpen={!!selectedResult}
                    onClose={closeDetail}
                    title={selectedResult.kanji || selectedResult.reading || ""}
                >
                    <div className="space-y-6">
                        {/* Header Section */}
                        <div className="text-center space-y-2">
                            <div className="text-4xl font-bold text-primary">
                                {selectedResult.kanji || selectedResult.reading}
                            </div>
                            <div className="text-xl text-muted-foreground flex items-center justify-center gap-2">
                                {selectedResult.reading}
                                {selectedResult.pitch && <span className="text-sm border px-1 rounded">{selectedResult.pitch}</span>}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        speak(selectedResult.reading || selectedResult.kanji || "");
                                    }}
                                >
                                    <Volume2 className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>

                        {/* Meanings & Examples */}
                        <div className="space-y-4">
                            {selectedResult.meanings.map((meaning, index) => {
                                const key = `${selectedResult.ent_seq}:${index}`;
                                const isAdded = addedKeys.has(key);
                                return (
                                    <div key={index} className="p-3 rounded-md bg-muted/30 border">
                                        <div className="flex items-start justify-between mb-2">
                                            <span className="font-medium text-lg text-primary/90">
                                                {index + 1}. {meaning.gloss}
                                            </span>
                                            <Button
                                                size="sm"
                                                variant={isAdded ? "secondary" : "outline"}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleAddMeaning(selectedResult, index);
                                                }}
                                                disabled={isAdded}
                                                className="gap-1 h-8"
                                            >
                                                {isAdded ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                                                {isAdded ? t.added : t.addCard}
                                            </Button>
                                        </div>

                                        {meaning.examples && meaning.examples.length > 0 && (
                                            <div className="mt-2 text-sm text-muted-foreground/90 pl-3 border-l-2 border-primary/20 space-y-2">
                                                {meaning.examples.map((ex, i) => (
                                                    <div key={i}>
                                                        <div className="italic text-foreground/90">{ex.text}</div>
                                                        <div className="opacity-75 text-xs font-medium">{ex.text_ja}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Actions Footer */}
                        <div className="pt-4 border-t flex flex-col gap-3">
                            <Button
                                variant={showVideo ? "secondary" : "outline"}
                                className="w-full gap-2"
                                onClick={() => setShowVideo(!showVideo)}
                            >
                                {t.examplesVideo}
                            </Button>

                            {showVideo && (
                                <div className="mt-4 animate-in fade-in zoom-in-95 duration-300">
                                    <YouGlishPlayer query={selectedResult.kanji || selectedResult.reading || ""} />
                                </div>
                            )}
                        </div>
                    </div>
                </SimpleDialog>
            )}
        </div>
    );
}
