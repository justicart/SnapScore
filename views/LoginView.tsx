import React from 'react';
import { Button } from '../components/Button';
import { IconQrCode } from '../components/Icons';

interface LoginViewProps {
  onLogin: () => void;
  isLoggingIn: boolean;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin, isLoggingIn }) => {
  return (
    <div className="min-h-[100dvh] bg-canvas flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-primary-deep/30 p-8 rounded-full mb-8 animate-pulse-slow shadow-2xl shadow-primary-deep/20">
        <IconQrCode className="w-20 h-20 text-primary-soft" />
      </div>
      
      <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">SnapScore Cards</h1>
      <p className="text-ink-muted mb-10 max-w-xs leading-relaxed">
        Smart AI scoring for your card games. 
        Connect your account to start scanning.
      </p>
      
      <div className="w-full max-w-xs space-y-6">
        <Button 
          onClick={onLogin} 
          fullWidth 
          className="py-4 text-lg shadow-primary-deep/50 hover:scale-105 transition-transform"
          disabled={isLoggingIn}
        >
          {isLoggingIn ? 'Connecting...' : 'Sign in with Google'}
        </Button>
        
        <div className="text-xs text-ink-subtle space-y-2">
            <p>Powered by Google Gemini</p>
            <p>
                By continuing, you agree to the use of your API quota.
                <br />
                <a 
                    href="https://ai.google.dev/gemini-api/docs/billing" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="underline hover:text-primary transition-colors"
                >
                    Billing & quota information
                </a>
            </p>
        </div>
      </div>
    </div>
  );
};