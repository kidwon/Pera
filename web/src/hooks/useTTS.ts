import { useState, useCallback } from 'react';

export const useTTS = () => {
    const speak = useCallback((text: string) => {
        if (!('speechSynthesis' in window)) {
            console.warn("Text-to-speech not supported");
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ja-JP';
        window.speechSynthesis.speak(utterance);
    }, []);

    const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

    return { speak, isSupported };
};
