import { useEffect, useState } from 'react';

declare global {
    interface Window {
        Telegram: {
            WebApp: any;
        };
    }
}

export function useTelegram() {
    const [webApp, setWebApp] = useState<any>(null);
    const [isReady, setIsReady] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
            const tg = window.Telegram.WebApp;
            setWebApp(tg);
            setIsReady(true);

            // Notify Telegram that the app is ready
            tg.ready();

            // Authenticate
            if (tg.initData) {
                fetch('/api/auth', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ initData: tg.initData }),
                })
                    .then((res) => res.json())
                    .then((data) => {
                        if (data.success) {
                            setIsAuthenticated(true);
                            setUser(data.user);
                        } else {
                            console.error('Authentication failed:', data.error);
                        }
                    })
                    .catch((err) => console.error('Auth error:', err));
            }
        }
    }, []);

    const onClose = () => {
        webApp?.close();
    };

    return {
        webApp,
        user,
        isReady,
        isAuthenticated,
        onClose,
    };
}
