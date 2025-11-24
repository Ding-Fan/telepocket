'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navigation } from '../../config/navigation';
import { cn } from '../../lib/utils';

export function BottomNav() {
    const pathname = usePathname();

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden animate-slide-up">
            <div className="mx-4 mb-4 bg-glass rounded-3xl shadow-2xl overflow-hidden border border-ocean-700/50">
                <div className="grid grid-cols-3 h-20">
                    {navigation.map((item) => {
                        const Icon = item.icon;
                        // Match exact path or /notes with any query params
                        const isActive = item.href === '/notes'
                            ? pathname.startsWith('/notes')
                            : pathname === item.href;

                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                    "relative flex flex-col items-center justify-center gap-1 transition-all duration-300",
                                    "hover:bg-white/5",
                                    isActive && "bg-gradient-to-t from-cyan-500/10 to-amber-500/10"
                                )}
                            >
                                {/* Active Indicator */}
                                {isActive && (
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-gradient-to-r from-cyan-500 to-amber-500 rounded-b-full animate-scale-in" />
                                )}

                                {/* Icon Container */}
                                <div className={cn(
                                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300",
                                    isActive
                                        ? "bg-gradient-to-br from-cyan-500 to-amber-500 shadow-glow scale-110"
                                        : "bg-ocean-800/30"
                                )}>
                                    <Icon className={cn(
                                        "w-5 h-5 transition-colors",
                                        isActive ? "text-white" : "text-ocean-300"
                                    )} />
                                </div>

                                {/* Label */}
                                <span className={cn(
                                    "text-xs font-medium transition-colors",
                                    isActive ? "text-white" : "text-ocean-400"
                                )}>
                                    {item.name}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
