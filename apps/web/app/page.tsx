'use client';

import { useRouter } from 'next/navigation';
import { useTelegram } from '../hooks/useTelegram';
import { AppLayout } from '../components/layout/AppLayout';
import { GlanceSection } from '../components/notes/GlanceSection';

export default function Home() {
    const router = useRouter();
    const { user, isAuthenticated } = useTelegram();

    if (!isAuthenticated) {
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

    return (
        <AppLayout>
            <div className="max-w-7xl mx-auto">
                {/* Welcome Header */}
                <div className="mb-8 animate-slide-up">
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-2 font-display">
                        Welcome back{user?.first_name ? `, ${user.first_name}` : ''}! 👋
                    </h1>
                    <p className="text-ocean-300 text-lg">
                        Manage and organize your Telepocket notes
                    </p>
                </div>

                {/* Glance Section */}
                <GlanceSection
                    userId={user?.id || 0}
                    onNoteClick={(noteId) => {
                        router.push(`/notes/${noteId}`);
                    }}
                />
            </div>
        </AppLayout>
    );
}
