/**
 * Mock Telegram WebApp API for local development
 * Only loads when NODE_ENV=development
 */

export function mockTelegramWebApp() {
  if (typeof window === 'undefined') return;
  if (process.env.NODE_ENV !== 'development') return;

  // Only mock if we don't have real Telegram data
  if (window.Telegram?.WebApp?.initData) {
    console.log('✅ Real Telegram WebApp detected, skipping mock');
    return;
  }

  console.log('🔧 Loading Telegram WebApp mock...');

  // Mock user data with real Telegram user ID
  const mockUser = {
    id: 229875405,
    first_name: 'Ding',
    last_name: '',
    username: 'dinguser',
    language_code: 'en',
  };

  // Generate mock initData (will bypass validation in dev mode)
  const mockInitData = new URLSearchParams({
    user: JSON.stringify(mockUser),
    auth_date: Math.floor(Date.now() / 1000).toString(),
    hash: 'mock_hash_dev_only',
  }).toString();

  // Mock Telegram WebApp API
  window.Telegram = {
    WebApp: {
      initData: mockInitData,
      initDataUnsafe: {
        user: mockUser,
        auth_date: Math.floor(Date.now() / 1000),
        hash: 'mock_hash_dev_only',
      },
      version: '6.0',
      platform: 'web',
      colorScheme: 'light',
      themeParams: {
        bg_color: '#ffffff',
        text_color: '#000000',
        hint_color: '#999999',
        link_color: '#2481cc',
        button_color: '#2481cc',
        button_text_color: '#ffffff',
      },
      isExpanded: true,
      viewportHeight: window.innerHeight,
      viewportStableHeight: window.innerHeight,
      headerColor: '#ffffff',
      backgroundColor: '#ffffff',

      // Methods
      ready: () => {
        console.log('📱 Mock Telegram WebApp: ready()');
      },
      expand: () => {
        console.log('📱 Mock Telegram WebApp: expand()');
      },
      close: () => {
        console.log('📱 Mock Telegram WebApp: close()');
      },
      enableClosingConfirmation: () => {
        console.log('📱 Mock Telegram WebApp: enableClosingConfirmation()');
      },
      disableClosingConfirmation: () => {
        console.log('📱 Mock Telegram WebApp: disableClosingConfirmation()');
      },

      // Additional mock objects
      MainButton: {
        text: '',
        color: '#2481cc',
        textColor: '#ffffff',
        isVisible: false,
        isActive: true,
        isProgressVisible: false,
        setText: (text: string) => console.log('MainButton.setText:', text),
        onClick: (callback: () => void) => console.log('MainButton.onClick:', callback),
        offClick: (callback: () => void) => console.log('MainButton.offClick:', callback),
        show: () => console.log('MainButton.show()'),
        hide: () => console.log('MainButton.hide()'),
        enable: () => console.log('MainButton.enable()'),
        disable: () => console.log('MainButton.disable()'),
        showProgress: (leaveActive?: boolean) => console.log('MainButton.showProgress:', leaveActive),
        hideProgress: () => console.log('MainButton.hideProgress()'),
      },

      BackButton: {
        isVisible: false,
        onClick: (callback: () => void) => console.log('BackButton.onClick:', callback),
        offClick: (callback: () => void) => console.log('BackButton.offClick:', callback),
        show: () => console.log('BackButton.show()'),
        hide: () => console.log('BackButton.hide()'),
      },
    },
  };

  console.log('✅ Telegram WebApp mock loaded with user:', mockUser);
  console.log('💡 To test in real Telegram, remove mock or set NODE_ENV=production');
}
