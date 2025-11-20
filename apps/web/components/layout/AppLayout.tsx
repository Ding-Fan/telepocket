import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';

interface AppLayoutProps {
    children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
    return (
        <div className="min-h-screen bg-ocean-950">
            <Sidebar />
            <div className="md:ml-72 min-h-screen">
                <main className="p-6 md:p-8 pb-28 md:pb-8 animate-fade-in">
                    {children}
                </main>
            </div>
            <BottomNav />
        </div>
    );
}
