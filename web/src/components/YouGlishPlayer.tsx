"use client";

import { useEffect, useRef } from 'react';

declare global {
    interface Window {
        YG: any;
    }
}

interface YouGlishPlayerProps {
    query: string;
    width?: number;
    height?: number;
    components?: number; // 72 = captions + speed + controls
}

export function YouGlishPlayer({ query, width = 640, height = 360, components = 72 }: YouGlishPlayerProps) {
    const widgetRef = useRef<any>(null);
    const containerId = "youglish-widget";

    useEffect(() => {
        // 1. Load the script if it doesn't exist
        if (!document.getElementById('youglish-script')) {
            const script = document.createElement('script');
            script.id = 'youglish-script';
            script.src = "https://youglish.com/public/emb/widget.js";
            script.async = true;
            document.body.appendChild(script);
        }

        // 2. Initialize widget when API is ready
        const initWidget = () => {
            if (window.YG && !widgetRef.current) {
                try {
                    widgetRef.current = new window.YG.Widget(containerId, {
                        width,
                        components,
                        events: {
                            'onError': (event: any) => console.error('YouGlish Error:', event),
                        }
                    });
                    // Initial fetch
                    if (query) {
                        widgetRef.current.fetch(query, "japanese");
                    }
                } catch (e) {
                    console.error("Error initializing YouGlish widget:", e);
                }
            }
        };

        // Check periodically if YG is loaded
        const interval = setInterval(() => {
            if (window.YG) {
                initWidget();
                clearInterval(interval);
            }
        }, 100);

        return () => clearInterval(interval);
    }, []); // Only run once on mount for initialization

    // 3. Update query when it changes
    useEffect(() => {
        if (widgetRef.current && query) {
            widgetRef.current.fetch(query, "japanese");
        }
    }, [query]);

    return (
        <div className="flex justify-center items-center w-full my-4">
            <div id={containerId} style={{ minHeight: height }}></div>
        </div>
    );
}
