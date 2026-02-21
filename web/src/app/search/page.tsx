"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Check, Volume2, Trash2, Settings } from "lucide-react";
import { useTTS } from "@/hooks/useTTS";
import { SimpleDialog } from "@/components/ui/simple-dialog";
import { YouGlishPlayer } from "@/components/YouGlishPlayer";
import { useLanguage } from "@/app/LanguageProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
interface SearchResult {
    ent_seq: string;
    kanji: string | null;
    reading: string | null;
    meanings: {
        gloss?: string;
        glosses: Record<string, string[]>;
        gloss_cn?: string | null;
        tags?: string[];
        examples?: {
            text: string;
            text_ja: string;
        }[];
    }[];
    pitch?: string;
    jlptLevel?: string;
}

const getJlptColor = (level?: string) => {
    switch (level?.toUpperCase()) {
        case 'N5': return "bg-blue-100 text-blue-800 border-blue-200";
        case 'N4': return "bg-green-100 text-green-800 border-green-200";
        case 'N3': return "bg-yellow-100 text-yellow-800 border-yellow-200";
        case 'N2': return "bg-orange-100 text-orange-800 border-orange-200";
        case 'N1': return "bg-red-100 text-red-800 border-red-200";
        default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
};

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
    const [selectedJlptLevel, setSelectedJlptLevel] = useState<string | null>(null);
    const [visibleLanguages, setVisibleLanguages] = useState<string[]>(['eng', 'cn']);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('visibleLanguages');
            if (saved) {
                try { setVisibleLanguages(JSON.parse(saved)); } catch (e) { }
            }
        }
    }, []);

    const toggleLanguage = (lang: string) => {
        const newLangs = visibleLanguages.includes(lang)
            ? visibleLanguages.filter(l => l !== lang)
            : [...visibleLanguages, lang];
        setVisibleLanguages(newLangs);
        localStorage.setItem('visibleLanguages', JSON.stringify(newLangs));
    };

    const AVAILABLE_LANGUAGES = [
        { code: 'eng', label: 'English' },
        { code: 'cn', label: '中文' },
        { code: 'dut', label: 'Nederlands' },
        { code: 'fre', label: 'Français' },
        { code: 'ger', label: 'Deutsch' },
        { code: 'hun', label: 'Magyar' },
        { code: 'rus', label: 'Русский' },
        { code: 'slv', label: 'Slovenščina' },
        { code: 'spa', label: 'Español' },
        { code: 'swe', label: 'Svenska' }
    ];

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (params.get("tab") === "myCards") {
                setActiveTab("myCards");
            }
        }
    }, []);

    const addCard = useMutation(api.cards.addCard);
    const removeCard = useMutation(api.cards.removeCard);
    const myCards = useQuery(api.cards.getAllCards);
    const { speak } = useTTS();

    // Filter cards by JLPT level
    const filteredCards = useMemo(() => {
        if (!myCards) return [];
        if (!selectedJlptLevel) return myCards;
        return myCards.filter(card => card.jlptLevel === selectedJlptLevel);
    }, [myCards, selectedJlptLevel]);

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
                meanings: [
                    {
                        // Pass the raw string from Convex if it exists for backwards compat, otherwise fallback to english map value or empty string
                        gloss: (result.meanings[meaningIndex] as any).gloss || (result.meanings[meaningIndex].glosses && result.meanings[meaningIndex].glosses["eng"] ? result.meanings[meaningIndex].glosses["eng"].join("; ") : ""),
                        glosses: result.meanings[meaningIndex].glosses || {},
                        gloss_cn: result.meanings[meaningIndex].gloss_cn ?? undefined,
                        tags: result.meanings[meaningIndex].tags || [],
                        examples: result.meanings[meaningIndex].examples || [],
                    }
                ],
                pitch: result.pitch ?? undefined,
                meaningIndex: meaningIndex,
                jlptLevel: result.jlptLevel,
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
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(true)}>
                        <Settings className="w-5 h-5 text-muted-foreground hover:text-primary" />
                    </Button>
                    <LanguageSwitcher />
                </div>
            </div>

            <SimpleDialog isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Translation Settings">
                <div className="space-y-4 py-2">
                    <h3 className="font-semibold text-sm text-muted-foreground border-b pb-2">Visible Languages</h3>
                    <div className="grid grid-cols-2 gap-3">
                        {AVAILABLE_LANGUAGES.map(lang => (
                            <label key={lang.code} className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="rounded border-gray-300 w-4 h-4 accent-primary"
                                    checked={visibleLanguages.includes(lang.code)}
                                    onChange={() => toggleLanguage(lang.code)}
                                />
                                <span className="text-sm">{lang.label}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </SimpleDialog>

            <Tabs defaultValue="search" value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                    <TabsTrigger value="search">{t.searchTab}</TabsTrigger>
                    <TabsTrigger value="myCards">{t.myCardsTab}</TabsTrigger>
                    <TabsTrigger value="library">{t.libraryTab}</TabsTrigger>
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
                                                {result.jlptLevel && (
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${getJlptColor(result.jlptLevel)}`}>
                                                        {result.jlptLevel}
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
                                            {result.meanings.map((m, i) => {
                                                const visibleGlosses = [];

                                                if (visibleLanguages.includes("cn") && m.gloss_cn) {
                                                    visibleGlosses.push(
                                                        <span key="cn"><span className="text-primary/80 font-medium">[{m.gloss_cn}] </span></span>
                                                    );
                                                }

                                                for (const [lang, translations] of Object.entries(m.glosses || {})) {
                                                    if (visibleLanguages.includes(lang)) {
                                                        const langPrefix = lang === 'eng' ? null : `[${lang.toUpperCase()}] `;
                                                        visibleGlosses.push(
                                                            <span key={lang}>
                                                                {langPrefix && <span className="font-medium text-[10.5px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground mr-1">{lang.toUpperCase()}</span>}
                                                                {translations.join("; ")}
                                                            </span>
                                                        );
                                                    }
                                                }

                                                // Legacy string fallback if mapping hasn't triggered yet
                                                if (m.gloss && (!m.glosses || Object.keys(m.glosses).length === 0) && visibleLanguages.includes("eng")) {
                                                    visibleGlosses.push(<span key="eng-legacy">{m.gloss}</span>);
                                                }

                                                if (visibleGlosses.length === 0) return null;

                                                return (
                                                    <span key={i} className="leading-relaxed">
                                                        {m.tags && m.tags.length > 0 && m.tags.map(tag => {
                                                            const isPos = tag.includes('noun') || tag.includes('verb') || tag.includes('adjective') || tag.includes('adverb');
                                                            const badgeVariant = isPos ? "bg-muted/60 text-muted-foreground" : "bg-primary/10 text-primary border-primary/20";
                                                            return (
                                                                <span key={tag} className={`mr-1.5 px-1.5 py-0.5 text-[10px] font-medium rounded border uppercase tracking-wider ${badgeVariant}`}>
                                                                    {tag}
                                                                </span>
                                                            );
                                                        })}
                                                        {visibleGlosses.map((g, gi) => (
                                                            <span key={gi}>
                                                                {g}
                                                                {gi < visibleGlosses.length - 1 ? <span className="mx-1 text-muted-foreground/40">·</span> : ""}
                                                            </span>
                                                        ))}
                                                        {i < result.meanings.length - 1 ? "; " : ""}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </TabsContent>

                <TabsContent value="myCards" className="mt-0">
                    {/* JLPT Level Filters */}
                    <div className="sticky top-0 bg-background/95 backdrop-blur py-4 z-10">
                        <div className="flex flex-wrap gap-2 justify-center">
                            <Button
                                variant={selectedJlptLevel === null ? "default" : "outline"}
                                size="sm"
                                onClick={() => setSelectedJlptLevel(null)}
                                className="h-8 px-3"
                            >
                                All
                            </Button>
                            {['N5', 'N4', 'N3', 'N2', 'N1'].map((level) => (
                                <Button
                                    key={level}
                                    variant={selectedJlptLevel === level ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setSelectedJlptLevel(level)}
                                    className={`h-8 px-3 ${selectedJlptLevel === level ? '' : getJlptColor(level)}`}
                                >
                                    {level}
                                </Button>
                            ))}
                        </div>
                        <div className="flex justify-center mt-3">
                            <Link href={selectedJlptLevel ? `/study?level=${selectedJlptLevel}&filterMode=true` : '/study?filterMode=true'}>
                                <Button className="w-full sm:w-auto shadow-sm gap-2">
                                    {t.study} {selectedJlptLevel ? `(${selectedJlptLevel})` : ''}
                                </Button>
                            </Link>
                        </div>
                    </div>

                    <div className="mt-4 space-y-4">
                        {myCards === undefined && <div className="text-center text-muted-foreground animate-pulse">...</div>}

                        {myCards && filteredCards.length === 0 && (
                            <div className="text-center py-10 text-muted-foreground">
                                {selectedJlptLevel ? `No ${selectedJlptLevel} cards` : t.noSavedCards}
                            </div>
                        )}

                        <motion.div
                            variants={containerVariants}
                            initial="hidden"
                            animate="show"
                            className="space-y-4"
                        >
                            <AnimatePresence mode="popLayout">
                                {filteredCards?.map((card) => (
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
                                                        <div className="flex items-baseline gap-2">
                                                            {card.kanji && card.reading && (
                                                                <span className="text-xs text-muted-foreground">
                                                                    ({card.reading})
                                                                </span>
                                                            )}
                                                            {card.jlptLevel && (
                                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${getJlptColor(card.jlptLevel)}`}>
                                                                    {card.jlptLevel}
                                                                </span>
                                                            )}
                                                        </div>
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
                                                    {card.meanings.map((m: any, i: number) => {
                                                        const enStr = m.glosses && m.glosses.eng ? m.glosses.eng.join("; ") : "";
                                                        return (
                                                            <span key={i}>
                                                                {m.gloss_cn ? <span className="text-primary/80 font-medium">[{m.gloss_cn}] </span> : null}
                                                                {enStr}
                                                                {i < card.meanings.length - 1 && enStr ? "; " : ""}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </motion.div>
                    </div>
                </TabsContent>

                <TabsContent value="library" className="mt-0">
                    <div className="flex flex-col items-center justify-center py-12 space-y-6">
                        <div className="text-center space-y-2">
                            <h2 className="text-2xl font-bold">Global JLPT Library</h2>
                            <p className="text-muted-foreground max-w-sm">
                                Study all words for a specific JLPT level. Words you mark as difficult will automatically be added to your My Cards collection.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-3 justify-center max-w-md mt-4">
                            {['N5', 'N4', 'N3', 'N2', 'N1'].map((level) => (
                                <Link
                                    key={`lib-${level}`}
                                    href={`/study?source=global&level=${level}`}
                                    className="w-[100px]"
                                >
                                    <Button
                                        variant="outline"
                                        className={`w-full h-12 text-lg font-medium border-2 hover:bg-muted ${getJlptColor(level)}`}
                                    >
                                        {level}
                                    </Button>
                                </Link>
                            ))}
                        </div>
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
                                {selectedResult.jlptLevel && (
                                    <span className={`text-sm px-2 py-0.5 rounded-full border font-medium ${getJlptColor(selectedResult.jlptLevel)}`}>
                                        {selectedResult.jlptLevel}
                                    </span>
                                )}
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

                                // Determine if this meaning block has any content visible right now
                                const hasCn = meaning.gloss_cn && visibleLanguages.includes("cn");
                                const hasOtherLang = Object.keys(meaning.glosses || {}).some(lang => visibleLanguages.includes(lang));
                                const hasLegacyEng = meaning.gloss && (!meaning.glosses || Object.keys(meaning.glosses).length === 0) && visibleLanguages.includes("eng");

                                // Skip rendering an empty box
                                if (!hasCn && !hasOtherLang && !hasLegacyEng) return null;

                                return (
                                    <div key={index} className="p-3 rounded-md bg-muted/30 border">
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="space-y-1">
                                                {meaning.gloss_cn && visibleLanguages.includes("cn") && (
                                                    <div className="text-lg font-bold text-primary">
                                                        {meaning.gloss_cn}
                                                    </div>
                                                )}
                                                <div className="text-muted-foreground leading-relaxed flex flex-wrap items-center gap-1.5 mt-1">
                                                    <span className="font-medium mr-1">{index + 1}.</span>
                                                    {meaning.tags?.map(tag => {
                                                        const isPos = tag.includes('noun') || tag.includes('verb') || tag.includes('adjective') || tag.includes('adverb');
                                                        const badgeVariant = isPos ? "bg-muted/60 text-muted-foreground" : "bg-primary/10 text-primary border-primary/20";
                                                        return (
                                                            <span key={tag} className={`px-1.5 py-0.5 text-[10px] font-medium rounded border uppercase tracking-wider ${badgeVariant}`}>
                                                                {tag}
                                                            </span>
                                                        );
                                                    })}
                                                    {Object.entries(meaning.glosses || {}).filter(([lang]) => visibleLanguages.includes(lang)).map(([lang, translations], gIdx, arr) => {
                                                        const langPrefix = lang === 'eng' ? null : `[${lang.toUpperCase()}]`;
                                                        return (
                                                            <span key={lang}>
                                                                {langPrefix && <span className="font-medium text-[10.5px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground mr-1.5">{langPrefix}</span>}
                                                                {translations.join("; ")}
                                                                {gIdx < arr.length - 1 ? <span className="mx-1.5 text-muted-foreground/40">·</span> : ""}
                                                            </span>
                                                        );
                                                    })}
                                                    {meaning.gloss && (!meaning.glosses || Object.keys(meaning.glosses).length === 0) && visibleLanguages.includes("eng") && (
                                                        <span>{meaning.gloss}</span>
                                                    )}
                                                </div>
                                            </div>
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
