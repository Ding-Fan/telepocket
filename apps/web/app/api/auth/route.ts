import { createHmac } from 'crypto';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { initData } = await request.json();

        if (!initData) {
            return NextResponse.json({ error: 'Missing initData' }, { status: 400 });
        }

        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        const userData = JSON.parse(urlParams.get('user') || '{}');

        // Skip HMAC validation in development mode
        if (process.env.NODE_ENV === 'development') {
            console.log('🔧 Development mode: Skipping HMAC validation');
            console.log('👤 Mock user authenticated:', userData);
            return NextResponse.json({ success: true, user: userData });
        }

        // Production: Validate HMAC signature
        urlParams.delete('hash');

        // Sort keys alphabetically
        const params = Array.from(urlParams.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');

        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) {
            console.error('TELEGRAM_BOT_TOKEN is not set');
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        // 1. Create secret key using HMAC-SHA256 with "WebAppData" as key and bot token as data
        const secretKey = createHmac('sha256', 'WebAppData')
            .update(botToken)
            .digest();

        // 2. Calculate hash using the secret key and the sorted params string
        const calculatedHash = createHmac('sha256', secretKey)
            .update(params)
            .digest('hex');

        // 3. Compare hashes
        if (calculatedHash === hash) {
            // Valid!
            // In a real app, you would issue a session token here (JWT, cookie, etc.)
            // For now, we just return success and the user data
            return NextResponse.json({ success: true, user: userData });
        } else {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }
    } catch (error) {
        console.error('Auth error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
