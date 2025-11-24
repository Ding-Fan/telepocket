'use client';

import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { Tag, User, Bell, Palette } from 'lucide-react';

export default function SettingsPage() {
  const settingsGroups = [
    {
      title: 'Management',
      items: [
        {
          name: 'Tags',
          description: 'Manage your tags and AI auto-tagging settings',
          href: '/tags',
          icon: Tag,
          iconColor: 'text-blue-400',
          bgColor: 'bg-blue-500/10',
        },
      ],
    },
    {
      title: 'Preferences',
      items: [
        {
          name: 'Profile',
          description: 'View and edit your profile information',
          href: '/settings/profile',
          icon: User,
          iconColor: 'text-purple-400',
          bgColor: 'bg-purple-500/10',
          disabled: true,
        },
        {
          name: 'Notifications',
          description: 'Configure notification preferences',
          href: '/settings/notifications',
          icon: Bell,
          iconColor: 'text-amber-400',
          bgColor: 'bg-amber-500/10',
          disabled: true,
        },
        {
          name: 'Appearance',
          description: 'Customize theme and display settings',
          href: '/settings/appearance',
          icon: Palette,
          iconColor: 'text-pink-400',
          bgColor: 'bg-pink-500/10',
          disabled: true,
        },
      ],
    },
  ];

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-slide-up">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2 font-display">
            Settings
          </h1>
          <p className="text-ocean-300 text-lg">
            Manage your preferences and application settings
          </p>
        </div>

        {/* Settings Groups */}
        <div className="space-y-8">
          {settingsGroups.map((group, groupIndex) => (
            <div
              key={group.title}
              className="animate-slide-up"
              style={{ animationDelay: `${groupIndex * 100}ms` }}
            >
              <h2 className="text-xl font-semibold text-white mb-4 font-display">
                {group.title}
              </h2>

              <div className="space-y-3">
                {group.items.map((item, itemIndex) => {
                  const Icon = item.icon;
                  const isDisabled = 'disabled' in item ? item.disabled : false;

                  const content = (
                    <div
                      className={`
                        bg-glass rounded-2xl p-6 border border-ocean-700/50
                        transition-all duration-300
                        ${!isDisabled ? 'hover:bg-ocean-800/50 hover:border-ocean-600/50 hover:shadow-lg cursor-pointer' : 'opacity-50 cursor-not-allowed'}
                        animate-fade-in
                      `}
                      style={{ animationDelay: `${(groupIndex * 100) + (itemIndex * 50)}ms` }}
                    >
                      <div className="flex items-start gap-4">
                        {/* Icon */}
                        <div className={`
                          w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0
                          ${item.bgColor}
                        `}>
                          <Icon className={`w-6 h-6 ${item.iconColor}`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold text-white font-display">
                              {item.name}
                            </h3>
                            {isDisabled && (
                              <span className="text-xs px-2 py-0.5 bg-ocean-700/50 text-ocean-300 rounded-full">
                                Coming Soon
                              </span>
                            )}
                          </div>
                          <p className="text-ocean-300 text-sm mt-1">
                            {item.description}
                          </p>
                        </div>

                        {/* Arrow */}
                        {!isDisabled && (
                          <div className="flex-shrink-0 mt-1">
                            <svg
                              className="w-5 h-5 text-ocean-400 group-hover:text-ocean-300 transition-colors"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  );

                  return isDisabled ? (
                    <div key={item.name}>{content}</div>
                  ) : (
                    <Link key={item.name} href={item.href} className="block group">
                      {content}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Info */}
        <div className="mt-12 p-6 bg-glass rounded-2xl border border-ocean-700/50 animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-amber-500 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-sm font-bold text-white">T</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-1 font-display">
                Telepocket Web Dashboard
              </h3>
              <p className="text-xs text-ocean-300">
                Connected to @telepocket_bot
              </p>
              <p className="text-xs text-ocean-400 mt-2">
                Version 1.0.0 • Built with Next.js & Supabase
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
