"use client";

import { Drawer } from "vaul";
import { YouGlishPlayer } from "./YouGlishPlayer";
import { Button } from "./ui/button";
import { PlayCircle } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/app/LanguageProvider";

interface VideoDrawerProps {
    query: string;
}

export function VideoDrawer({ query }: VideoDrawerProps) {
    const { t } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);

    return (
        <Drawer.Root open={isOpen} onOpenChange={setIsOpen}>
            <Drawer.Trigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <PlayCircle className="h-4 w-4" />
                    {t.examplesVideo}
                </Button>
            </Drawer.Trigger>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 bg-black/40" />
                <Drawer.Content className="bg-background flex flex-col rounded-t-[10px] h-[85vh] mt-24 fixed bottom-0 left-0 right-0 border-t z-50 focus:outline-none">
                    <div className="p-4 bg-background rounded-t-[10px] flex-1 overflow-y-auto">
                        <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-muted mb-8" />
                        <div className="flex flex-col items-center">
                            <Drawer.Title className="font-medium mb-4">
                                {t.examples}: "{query}"
                            </Drawer.Title>
                            {isOpen && (
                                <YouGlishPlayer query={query} />
                            )}
                        </div>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}
