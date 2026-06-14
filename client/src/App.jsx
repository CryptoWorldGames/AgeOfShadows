import React, { useEffect, useState } from 'react';
import axios from 'axios';
import GameScene from './GameScene';
import './App.css';

const API_BASE = '/api';

export default function App() {
  const [playerId, setPlayerId] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initGame = async () => {
      try {
        console.log('Joining game...');
        const joinRes = await axios.post(`${API_BASE}/join`);
        const id = joinRes.data.playerId;
        setPlayerId(id);

        const stateRes = await axios.get(`${API_BASE}/state/${id}`);
        setGameState(stateRes.data);
        setLoading(false);

        const interval = setInterval(async () => {
          const res = await axios.get(`${API_BASE}/state/${id}`);
          setGameState(res.data);
        }, 1000);

        return () => {
          clearInterval(interval);
        };
      } catch (err) {
        console.error('Failed to join game:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    initGame();
  }, []);

  if (loading) return <div className="loading">Initializing Age of Shadows...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (!playerId) return <div className="error">Failed to join game</div>;

  return (
    <div className="app">
      <h1>⚔️ Age of Shadows</h1>
      <GameScene playerId={playerId} gameState={gameState} />
    </div>
  );
}