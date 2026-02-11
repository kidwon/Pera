"use client";

import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/app/LanguageProvider";

export default function SeedPage() {
    const { t } = useLanguage();
    const seed = useMutation(api.cards.seed);
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [message, setMessage] = useState("");

    const handleSeed = async () => {
        setStatus("loading");
        setMessage("...");

        try {
            // 1. Fetch from Ktor
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8082";
            const response = await fetch(`${baseUrl}/api/dictionary/seed`);
            if (!response.ok) {
                throw new Error(`Server fetch failed: ${response.statusText}`);
            }
            const entries = await response.json();

            setMessage(`Fetched ${entries.length}.`);

            // 2. Call Convex Mutation
            const count = await seed({ cards: entries });

            setStatus("success");
            setMessage(t.seedSuccess);
        } catch (err) {
            console.error(err);
            setStatus("error");
            setMessage(err instanceof Error ? err.message : "Error");
        }
    };
    const deleteAll = useMutation(api.cards.deleteAllCards);

    return (
        <div className="container mx-auto p-10 flex justify-center">
            <Card className="w-[400px]">
                <CardHeader>
                    <CardTitle>{t.seedDatabase}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <p className="text-sm text-muted-foreground">
                        {t.appName}: Initializing dictionary data...
                    </p>

                    <div className="bg-muted p-4 rounded-md min-h-[60px] text-sm">
                        {status === "idle" && "Ready."}
                        {status === "loading" && <span className="text-primary">{message || t.seeding}</span>}
                        {status === "success" && <span className="text-green-500">{message}</span>}
                        {status === "error" && <span className="text-destructive">Error: {message}</span>}
                    </div>

                    <Button
                        onClick={handleSeed}
                        disabled={status === "loading"}
                        className="w-full"
                    >
                        {status === "loading" ? t.seeding : t.seedDatabase}
                    </Button>

                    <Button
                        variant="destructive"
                        onClick={async () => {
                            // if(!confirm("Are you sure? This will delete ALL cards.")) return;
                            setStatus("loading");
                            setMessage("Deleting all cards...");
                            try {
                                const count = await deleteAll();
                                setStatus("success");
                                setMessage(`Deleted ${count} cards.`);
                            } catch (e: any) {
                                setStatus("error");
                                setMessage(e.message);
                            }
                        }}
                        disabled={status === "loading"}
                        className="w-full"
                    >
                        Delete All Cards
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
