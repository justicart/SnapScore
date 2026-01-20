
import { useState, useEffect } from 'react';
import { Player, CardSettings, AppView, Round } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const DEFAULT_SETTINGS: CardSettings = {
  jokerValue: 50,
  aceValue: 20,
  faceCardBehavior: 'fixed',
  fixedFaceValue: 10,
  numberCardBehavior: 'face',
  fixedNumberValue: 5,
  winningScoreType: 'lowest'
};

export const useGameState = (isClient: boolean) => {
  const [view, setView] = useState<AppView>(AppView.SETUP);
  const [players, setPlayers] = useState<Player[]>([]);
  const [settings, setSettings] = useState<CardSettings>(DEFAULT_SETTINGS);
  
  // Scanning State
  const [scanPlayerId, setScanPlayerId] = useState<string | null>(null);
  const [scanRoundId, setScanRoundId] = useState<string | null>(null);
  const [targetRoundIndex, setTargetRoundIndex] = useState<number | null>(null);

  // --- Local Storage & Migration (Host Only) ---
  useEffect(() => {
    if (!isClient) {
        const savedPlayers = localStorage.getItem('snapscore_players');
        const savedSettings = localStorage.getItem('snapscore_settings');
        
        if (savedPlayers) {
            try {
                const parsed = JSON.parse(savedPlayers);
                const migratedPlayers: Player[] = parsed.map((p: any) => {
                    if (p.rounds) return { ...p, deviceId: p.deviceId }; // Keep deviceId
                    // Migration for old format
                    const rounds: Round[] = (p.history || []).map((score: number) => ({
                        type: 'manual',
                        id: uuidv4(),
                        score,
                        timestamp: Date.now()
                    }));
                    return { id: p.id, name: p.name, rounds, deviceId: p.deviceId };
                });
                setPlayers(migratedPlayers);
                if (migratedPlayers.length > 0) setView(AppView.GAME);
            } catch (e) {
                console.error("Failed to load saved players", e);
            }
        }

        if (savedSettings) {
            try {
                const parsed = JSON.parse(savedSettings);
                const migratedSettings: CardSettings = {
                    ...DEFAULT_SETTINGS,
                    ...parsed,
                    fixedFaceValue: parsed.fixedFaceValue ?? parsed.faceValue ?? DEFAULT_SETTINGS.fixedFaceValue,
                    faceCardBehavior: parsed.faceCardBehavior ?? DEFAULT_SETTINGS.faceCardBehavior,
                    winningScoreType: parsed.winningScoreType ?? DEFAULT_SETTINGS.winningScoreType
                };
                setSettings(migratedSettings);
            } catch (e) {
                console.error("Failed to load saved settings", e);
            }
        }
    }
  }, []); 

  // Persist State
  useEffect(() => {
    if (!isClient) {
        localStorage.setItem('snapscore_players', JSON.stringify(players));
    }
  }, [players, isClient]);

  useEffect(() => {
    if (!isClient) {
        localStorage.setItem('snapscore_settings', JSON.stringify(settings));
    }
  }, [settings, isClient]);

  // Actions
  const updatePlayerRound = (playerId: string, round: Round, index?: number) => {
    setPlayers(prev => prev.map(p => {
      if (p.id === playerId) {
        const newRounds = [...p.rounds];
        
        // 1. If explicit index is provided
        if (typeof index === 'number') {
            // Fill gaps with 0 manual rounds if needed
            while (newRounds.length < index) {
                newRounds.push({
                    type: 'manual',
                    id: uuidv4(),
                    score: 0,
                    timestamp: Date.now()
                });
            }
            newRounds[index] = round;
        } 
        // 2. If no index, check if round ID exists to update
        else {
            const existingRoundIndex = newRounds.findIndex(r => r.id === round.id);
            if (existingRoundIndex >= 0) {
                newRounds[existingRoundIndex] = round;
            } else {
                newRounds.push(round);
            }
        }
        
        return { ...p, rounds: newRounds };
      }
      return p;
    }));
  };

  const deletePlayerRound = (playerId: string, roundId: string) => {
    setPlayers(prev => prev.map(p => {
      if (p.id === playerId) {
        return {
          ...p,
          rounds: p.rounds.filter(r => r.id !== roundId)
        };
      }
      return p;
    }));
  };

  const removePlayer = (playerId: string) => {
      setPlayers(prev => prev.filter(p => p.id !== playerId));
  };

  const addPlayers = (newPlayers: Player[]) => {
      setPlayers(prev => [...prev, ...newPlayers]);
  };

  const resetRounds = () => {
      if (players.length > 0) {
        try {
            localStorage.setItem('snapscore_last_game', JSON.stringify({ 
                timestamp: Date.now(), 
                players, 
                settings 
            }));
        } catch (e) { console.warn("Failed to save history", e); }
      }
      
      const resetPlayers = players.map(p => ({ ...p, rounds: [] }));
      setPlayers(resetPlayers);
  };

  const clearSession = () => {
      setPlayers([]);
      setSettings(DEFAULT_SETTINGS);
      localStorage.removeItem('snapscore_players');
      localStorage.removeItem('snapscore_settings');
  };

  return {
      players, setPlayers,
      settings, setSettings,
      view, setView,
      scanPlayerId, setScanPlayerId,
      scanRoundId, setScanRoundId,
      targetRoundIndex, setTargetRoundIndex,
      updatePlayerRound,
      deletePlayerRound,
      removePlayer,
      addPlayers,
      resetRounds,
      clearSession
  };
};
