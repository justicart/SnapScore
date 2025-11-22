
import React from 'react';
import { Button } from '../components/Button';
import { IconQrCode } from '../components/Icons';

interface LoginViewProps {
  onLogin: () => void;
  isLoggingIn: boolean;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin, isLoggingIn }) => {
  return (
    <div className="min-h-[100dvh] bg-felt-900 flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-emerald-900/30 p-8 rounded-full mb-8 animate-pulse-slow shadow-2xl shadow-emerald-900/20">
        <IconQrCode className="w-20 h-20 text-emerald-400" />
      </div>
      
      <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">SnapScore Cards</h1>
      <p className="text-slate-400 mb-10 max-w-xs leading-relaxed">
        Smart AI scoring for your card games. 
        Connect your account to start scanning.
      </p>
      
      <div className="w-full max-w-xs space-y-6">
        <Button 
          onClick={onLogin} 
          fullWidth 
          className="py-4 text-lg shadow-emerald-900/50 hover:scale-105 transition-transform"
          disabled={isLoggingIn}
        >
          {isLoggingIn ? 'Connecting...' : 'Sign in with Google'}
        </Button>
        
        <div className="text-xs text-slate-600 space-y-2">
            <p>Powered by Google Gemini</p>
            <p>
                By continuing, you agree to the use of your API quota.
                <br />
                <a 
                    href="https://ai.google.dev/gemini-api/docs/billing" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="underline hover:text-emerald-500 transition-colors"
                >
                    Billing & Quota Information
                </a>
            </p>
        </div>
      </div>
    </div>
  );
};