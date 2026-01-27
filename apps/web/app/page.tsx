'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegram } from '../hooks/useTelegram';

export default function Home() {
    const router = useRouter();
    const { isAuthenticated } = useTelegram();

    useEffect(() => {
        if (isAuthenticated) {
            router.replace('/notes');
        }
    }, [isAuthenticated, router]);

    return (
        <div className="min-h-screen bg-ocean-950 flex items-center justify-center p-4">
            <div className="text-center animate-fade-in">
                <div className="w-16 h-16 mx-auto mb-6 rounded-3xl gradient-accent flex items-center justify-center shadow-glow">
                    <span className="text-3xl font-bold text-white font-display">T</span>
                </div>
                <h1 className="text-3xl font-bold text-white mb-3 font-display">Telepocket</h1>
                <p className="text-ocean-300 text-lg">Authenticating...</p>
            </div>
        </div>
    );
}
