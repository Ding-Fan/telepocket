'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navigation } from '../../config/navigation';
import { cn } from '../../lib/utils';

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="fixed top-0 left-0 z-40 w-72 h-screen transition-transform -translate-x-full md:translate-x-0 gradient-ocean border-r border-ocean-700/50">
            <div className="h-full px-6 py-8 overflow-y-auto flex flex-col">
                {/* Logo/Brand */}
                <Link href="/" className="flex items-center gap-3 mb-12 group">
                    <div className="w-10 h-10 rounded-2xl gradient-accent flex items-center justify-center shadow-glow transition-transform group-hover:scale-110">
                        <span className="text-xl font-bold text-white font-display">T</span>
                    </div>
                    <div>
                        <span className="text-2xl font-bold text-white font-display tracking-tight">Telepocket</span>
                        <span className="block text-xs text-ocean-300 font-medium">Notes Dashboard</span>
                    </div>
                </Link>

                {/* Navigation */}
                <nav className="space-y-2 flex-1">
                    {navigation.map((item, index) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;

                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                    "nav-link group",
                                    isActive && "nav-link-active",
                                    "animate-slide-up"
                                )}
                                style={{ animationDelay: `${index * 50}ms` }}
                            >
                                <div className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300",
                                    isActive
                                        ? "bg-gradient-to-br from-cyan-500 to-amber-500 shadow-glow"
                                        : "bg-ocean-800/50 group-hover:bg-ocean-700/50"
                                )}>
                                    <Icon className={cn(
                                        "w-5 h-5 transition-colors",
                                        isActive ? "text-white" : "text-ocean-300 group-hover:text-white"
                                    )} />
                                </div>
                                <span className={cn(
                                    "font-medium text-sm",
                                    isActive ? "text-white" : "text-ocean-300 group-hover:text-white"
                                )}>
                                    {item.name}
                                </span>
                            </Link>
                        );
                    })}
                </nav>

                {/* Footer Info */}
                <div className="mt-6 pt-6 border-t border-ocean-700/50">
                    <div className="bg-glass rounded-2xl p-4">
                        <p className="text-xs text-ocean-300 mb-1">Connected to Telegram</p>
                        <p className="text-sm text-white font-medium font-display">@telepocket_bot</p>
                    </div>
                </div>
            </div>
        </aside>
    );
}
