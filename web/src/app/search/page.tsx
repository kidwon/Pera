"use client";

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Check, Volume2 } from "lucide-react";
import { useTTS } from "@/hooks/useTTS";
import { SimpleDialog } from "@/components/ui/simple-dialog";
import { YouGlishPlayer } from "@/components/YouGlishPlayer";

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

export default function SearchPage() {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set());
    const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
    const [showVideo, setShowVideo] = useState(false);

    const addCard = useMutation(api.cards.addCard);
    const { speak } = useTTS();

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
        const key = `${result.ent_seq}:${meaningIndex}`;
        try {
            await addCard({
                ent_seq: result.ent_seq,
                kanji: result.kanji,
                reading: result.reading,
                meanings: [result.meanings[meaningIndex]], // Single meaning
                pitch: result.pitch ?? undefined,
                meaningIndex: meaningIndex,
            });
            setAddedKeys((prev) => new Set(prev).add(key));
        } catch (error) {
            console.error("Failed to add card:", error);
            // @ts-ignore
            const errorMessage = error.message || JSON.stringify(error);
            alert(`Failed to add card: ${errorMessage}`);
        }
    };

    const handleAddAll = async (result: SearchResult) => {
        try {
            // Add all meanings as separate cards
            for (let i = 0; i < result.meanings.length; i++) {
                const key = `${result.ent_seq}:${i}`;
                if (!addedKeys.has(key)) {
                    await addCard({
                        ent_seq: result.ent_seq,
                        kanji: result.kanji,
                        reading: result.reading,
                        meanings: [result.meanings[i]], // Pass specific meaning object
                        pitch: result.pitch ?? undefined,
                        meaningIndex: i,
                    });
                    setAddedKeys((prev) => new Set(prev).add(key));
                }
            }
        } catch (error) {
            console.error("Failed to add cards:", error);
            alert("Failed to add cards. Make sure you are logged in (or using Dev Admin).");
        }
    };

    const isAllAdded = (result: SearchResult) => {
        return result.meanings.every((_, i) => addedKeys.has(`${result.ent_seq}:${i}`));
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
            <h1 className="text-3xl font-bold mb-6 text-center">ペラペラ</h1>

            <div className="sticky top-0 bg-background/95 backdrop-blur py-4 z-10">
                <Input
                    placeholder="Search word/meaning (e.g. ねこ, cat)..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="text-lg h-12"
                    autoFocus
                />
            </div>

            <div className="mt-4 space-y-4">
                {loading && <div className="text-center text-muted-foreground animate-pulse">Searching...</div>}

                {!loading && results.length === 0 && query.trim() !== "" && (
                    <div className="text-center text-muted-foreground">No results found.</div>
                )}

                {results.map((result) => (
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
                                <div className="text-muted-foreground">
                                    <Volume2 className="h-4 w-4" />
                                </div>
                            </div>
                            <div className="text-sm text-muted-foreground line-clamp-2">
                                {result.meanings.map(m => m.gloss).join("; ")}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Detail View Dialog */}
            {selectedResult && (
                <SimpleDialog
                    isOpen={!!selectedResult}
                    onClose={closeDetail}
                    title="Card Details"
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
                                            <span className="font-medium text-lg">
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
                                                {isAdded ? "Added" : "Add"}
                                            </Button>
                                        </div>

                                        {meaning.examples && meaning.examples.length > 0 && (
                                            <div className="mt-2 text-sm text-muted-foreground/90 pl-3 border-l-2 border-primary/20 space-y-2">
                                                {meaning.examples.map((ex, i) => (
                                                    <div key={i}>
                                                        <div className="italic">{ex.text}</div>
                                                        <div className="opacity-75 text-xs">{ex.text_ja}</div>
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
                                variant={showVideo ? "secondary" : "default"}
                                className="w-full gap-2"
                                onClick={() => setShowVideo(!showVideo)}
                            >
                                {showVideo ? "Hide Video Examples" : "Watch Real-world Examples"}
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
