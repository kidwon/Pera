"use client";

import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useState } from "react";
import { useLanguage } from "@/app/LanguageProvider";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Database } from "lucide-react";

export default function SeedPage() {
    const { t } = useLanguage();
    const seed = useMutation(api.cards.seed);
    const deleteAll = useMutation(api.cards.deleteAllCards);
    const testPing = useMutation(api.cards.testPing);
    const seedOne = useMutation(api.cards.seedOne);
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [message, setMessage] = useState("");

    const handlePing = async () => {
        setStatus("loading");
        setMessage("Testing connection...");
        try {
            const result = await testPing();
            console.log("[PING] Result:", result);
            setStatus("success");
            setMessage(`Ping OK: ${result}`);
        } catch (err: any) {
            console.error("[PING] Error:", err);
            setStatus("error");
            setMessage(`Ping FAILED: ${err.message}`);
        }
    };

    const handleSeedOne = async () => {
        setStatus("loading");
        setMessage("Inserting one test card...");
        try {
            const result = await seedOne();
            console.log("[SEED_ONE] Result:", result);
            setStatus("success");
            setMessage(`SeedOne OK: ${result}`);
        } catch (err: any) {
            console.error("[SEED_ONE] Error:", err);
            setStatus("error");
            setMessage(`SeedOne FAILED: ${err.message}`);
        }
    };

    const handleSeed = async () => {
        setStatus("loading");
        setMessage("Fetching dictionary data...");

        try {
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8082";
            const response = await fetch(`${baseUrl}/api/dictionary/seed`);
            if (!response.ok) {
                throw new Error(`Server fetch failed: ${response.statusText}`);
            }
            const entries = await response.json();

            console.log("[SEED] Fetched entries:", entries.length);
            setMessage(`Fetched ${entries.length}. Synchronizing...`);

            const jsonStr = JSON.stringify(entries);
            console.log(`[SEED] JSON payload size: ${jsonStr.length} bytes`);
            const result = await seed({ json: jsonStr });
            console.log("[SEED] Result:", result);

            if (typeof result === 'string' && (result.startsWith("ERROR:") || result.startsWith("FATAL:"))) {
                setStatus("error");
                setMessage(result);
            } else {
                setStatus("success");
                setMessage(`${t.seedSuccess} | ${result}`);
            }
        } catch (err) {
            console.error("[SEED] Frontend Error:", err);
            setStatus("error");
            setMessage(err instanceof Error ? `[Client] ${err.message}` : "An unexpected error occurred.");
        }
    };

    const handleClear = async () => {
        if (!confirm("Are you sure? This will delete ALL cards permanently.")) return;
        setStatus("loading");
        setMessage("Clearing database...");
        try {
            const count = await deleteAll();
            setStatus("success");
            setMessage(`Deleted ${count} cards.`);
        } catch (err: any) {
            setStatus("error");
            setMessage(err.message || "Failed to clear cards.");
        }
    };

    return (
        <div className="container mx-auto p-10 flex flex-col items-center gap-6">
            <Card className="w-[520px] shadow-lg border-2 border-primary/10">
                <CardHeader className="text-center pb-2">
                    <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
                        <Database className="w-6 h-6 text-primary" />
                        {t.seedDatabase}
                    </CardTitle>
                    <CardDescription>
                        Database management &amp; diagnostics
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-5 pt-4">
                    {/* Status Display */}
                    <div className={cn(
                        "p-4 rounded-xl border flex flex-col gap-1 transition-all min-h-[60px]",
                        status === "success" ? "bg-green-500/5 border-green-500/20" :
                            status === "error" ? "bg-red-500/5 border-red-500/20" :
                                status === "loading" ? "bg-blue-500/5 border-blue-500/20" :
                                    "bg-muted/50 border-muted-foreground/10"
                    )}>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            System Status
                        </h4>
                        <p className={cn(
                            "text-sm font-medium break-all",
                            status === "success" ? "text-green-600" :
                                status === "error" ? "text-red-600" :
                                    "text-foreground"
                        )}>
                            {status === "idle" && "Ready."}
                            {status === "loading" && (
                                <span className="flex items-center gap-2">
                                    <span className="animate-pulse">●</span> {message}
                                </span>
                            )}
                            {status === "success" && message}
                            {status === "error" && message}
                        </p>
                    </div>

                    {/* Diagnostic Section */}
                    <div className="border rounded-lg p-3 bg-muted/30">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                            🔬 Diagnostics
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={handlePing}
                                disabled={status === "loading"}
                            >
                                Test Ping
                            </Button>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={handleSeedOne}
                                disabled={status === "loading"}
                            >
                                Seed One Card
                            </Button>
                        </div>
                    </div>

                    {/* Main Actions */}
                    <div className="grid grid-cols-1 gap-3">
                        <Button
                            onClick={handleSeed}
                            disabled={status === "loading"}
                            className="h-12 text-base font-semibold"
                        >
                            {status === "loading" && message.includes("Synchronizing") ? "Synchronizing..." : t.seedDatabase}
                        </Button>

                        <Button
                            variant="outline"
                            onClick={handleClear}
                            disabled={status === "loading"}
                            className="h-12 text-destructive hover:text-destructive hover:bg-destructive/5 font-medium border-destructive/20"
                        >
                            Clear Collection (Reset)
                        </Button>
                    </div>

                    <div className="text-[10px] text-center text-muted-foreground uppercase tracking-widest font-bold opacity-30">
                        Admin Only Interface
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
