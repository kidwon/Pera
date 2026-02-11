"use client";

import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SeedPage() {
    const seed = useMutation(api.cards.seed);
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [message, setMessage] = useState("");

    const handleSeed = async () => {
        setStatus("loading");
        setMessage("Fetching dictionary from server...");

        try {
            // 1. Fetch from Ktor
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8082";
            const response = await fetch(`${baseUrl}/api/dictionary/seed`);
            if (!response.ok) {
                throw new Error(`Server fetch failed: ${response.statusText}`);
            }
            const entries = await response.json();

            setMessage(`Fetched ${entries.length} entries. Seeding Convex...`);

            // 2. Call Convex Mutation
            const count = await seed({ cards: entries });

            setStatus("success");
            setMessage(`Successfully seeded ${count} new cards!`);
        } catch (err) {
            console.error(err);
            setStatus("error");
            setMessage(err instanceof Error ? err.message : "Undefined error");
        }
    };
    const deleteAll = useMutation(api.cards.deleteAllCards);

    return (
        <div className="container mx-auto p-10 flex justify-center">
            <Card className="w-[400px]">
                <CardHeader>
                    <CardTitle>Dictionary Seeding</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <p className="text-sm text-gray-500">
                        Fetches dictionary data from the local Ktor server (port 8081) and seeds it into the Convex database.
                    </p>

                    <div className="bg-slate-100 p-4 rounded-md min-h-[60px] text-sm">
                        {status === "idle" && "Ready to seed."}
                        {status === "loading" && <span className="text-blue-500">{message}</span>}
                        {status === "success" && <span className="text-green-500">{message}</span>}
                        {status === "error" && <span className="text-red-500">Error: {message}</span>}
                    </div>

                    <Button
                        onClick={handleSeed}
                        disabled={status === "loading"}
                        className="w-full"
                    >
                        {status === "loading" ? "Seeding..." : "Start Seeding"}
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
