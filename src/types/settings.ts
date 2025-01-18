export interface UserSettings {
  personalInfo: {
    displayName: string;
    email: string;
    avatarUrl: string;
    bio: string;
    profileVisibility: 'public' | 'private' | 'contacts-only';
  };
  security: {
    twoFactorEnabled: boolean;
    lastPasswordChange: string;
    loginNotifications: boolean;
  };
  notifications: {
    newMessage: boolean;
    mentions: boolean;
    groupInvites: boolean;
    messagePreview: boolean;
    sound: boolean;
    emailNotifications: boolean;
  };
  preferences: {
    language: string;
    theme: 'light' | 'dark' | 'system';
    fontSize: 'small' | 'medium' | 'large';
    messageAlignment: 'left' | 'right';
    clockFormat: '12h' | '24h';
  };
}

export type Language = {
  code: string;
  name: string;
  nativeName: string;
};

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
];
