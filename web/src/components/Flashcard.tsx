'use client'

import { useState } from 'react'
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion'


interface FlashcardProps {
    front: React.ReactNode
    back: React.ReactNode
    onSwipe: (direction: 'left' | 'right') => void
}

export function Flashcard({ front, back, onSwipe }: FlashcardProps) {
    const [isFlipped, setIsFlipped] = useState(false)
    const x = useMotionValue(0)
    const rotate = useTransform(x, [-200, 200], [-30, 30])
    const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0])
    const background = useTransform(
        x,
        [-150, 0, 150],
        ['rgb(239, 68, 68)', 'rgb(255, 255, 255)', 'rgb(34, 197, 94)']
    )

    const handleDragEnd = (event: any, info: PanInfo) => {
        if (info.offset.x > 100) {
            onSwipe('right')
        } else if (info.offset.x < -100) {
            onSwipe('left')
        }
    }

    return (
        <div className="perspective-1000 w-full max-w-sm h-96 relative cursor-grab active:cursor-grabbing">
            <motion.div
                style={{ x, rotate, opacity }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.7}
                onDragEnd={handleDragEnd}
                className="w-full h-full relative preserve-3d"
                onClick={() => setIsFlipped(!isFlipped)}
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ duration: 0.6 }}
            >
                {/* Front */}
                <div className="absolute backface-hidden w-full h-full">
                    <div className="w-full h-full bg-card border rounded-xl shadow-xl flex items-center justify-center p-6 text-center">
                        {front}
                    </div>
                </div>

                {/* Back */}
                <div className="absolute backface-hidden w-full h-full rotate-y-180">
                    <div className="w-full h-full bg-card border rounded-xl shadow-xl flex items-center justify-center p-6 text-center">
                        {back}
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
