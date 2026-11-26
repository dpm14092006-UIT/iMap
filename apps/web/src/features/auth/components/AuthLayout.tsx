import type { ReactNode } from 'react';
import { Icon } from '../../../shared/ui/Icon';
import { AuthScenery } from './AuthScenery';

type AuthLayoutProps = {
  language: 'vi' | 'en';
  onLanguageChange: (language: 'vi' | 'en') => void;
  onBack?: () => void;
  initialScene?: string;
  backLabel: string;
  children: ReactNode;
};

export function AuthLayout({
  language,
  onLanguageChange,
  onBack,
  initialScene,
  backLabel,
  children,
}: AuthLayoutProps) {
  const backContent = (
    <>
      <Icon name="arrow-left" size={18} />
      <span>{backLabel}</span>
    </>
  );
  return (
    <div className="imap-auth-layout">
      <header className="imap-auth-header">
        <span className="imap-auth-wordmark">iMap</span>
        <div className="imap-auth-header-actions">
          {onBack ? (
            <button type="button" className="imap-auth-back" onClick={onBack}>
              {backContent}
            </button>
          ) : (
            <a href="/" className="imap-auth-back">
              {backContent}
            </a>
          )}
          <button
            type="button"
            className="imap-auth-language"
            aria-label={language === 'vi' ? 'Chuyển sang tiếng Anh' : 'Switch to Vietnamese'}
            onClick={() => onLanguageChange(language === 'vi' ? 'en' : 'vi')}
          >
            {language.toUpperCase()}
          </button>
        </div>
      </header>
      <div className="imap-auth-art">
        <AuthScenery language={language} initialScene={initialScene} />
      </div>
      <div className="imap-auth-form">{children}</div>
    </div>
  );
}
