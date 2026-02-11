"use client";

import { useLanguage } from "@/app/LanguageProvider";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

export function LanguageSwitcher() {
    const { language, setLanguage } = useLanguage();

    return (
        <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-2"
            onClick={() => setLanguage(language === "zh" ? "en" : "zh")}
        >
            <Globe className="h-4 w-4" />
            <span>{language === "zh" ? "EN" : "中文"}</span>
        </Button>
    );
}
