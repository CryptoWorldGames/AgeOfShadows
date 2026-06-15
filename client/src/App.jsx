import React, { useState } from 'react';
import GameScene from './GameScene';

function SplashScreen({ onEnter }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  function handleEnter() {
    if (!name.trim()) { setError('Please enter your name'); return; }
    onEnter(name.trim());
  }

  return (
    <div style={{
      width:'100vw', height:'100vh', background:'linear-gradient(135deg, #0a0a0a 0%, #1a0a00 50%, #0a0a1a 100%)',
      display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column',
      fontFamily:"'Segoe UI', sans-serif", color:'#fff', position:'relative', overflow:'hidden'
    }}>
      {/* Background stars */}
      <div style={{position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none'}}>
        {[...Array(80)].map((_,i)=>(
          <div key={i} style={{
            position:'absolute',
            left:`${Math.random()*100}%`, top:`${Math.random()*100}%`,
            width: Math.random()>0.8?'2px':'1px', height: Math.random()>0.8?'2px':'1px',
            background:'#fff', borderRadius:'50%', opacity: 0.3+Math.random()*0.7
          }}/>
        ))}
      </div>

      {/* Logo */}
      <div style={{textAlign:'center', marginBottom:'40px', zIndex:1}}>
        <div style={{fontSize:'64px', marginBottom:'8px'}}>⚔️</div>
        <h1 style={{
          fontSize:'52px', fontWeight:'900', margin:0, letterSpacing:'4px',
          background:'linear-gradient(135deg, #c8a84b, #ffd700, #c8a84b)',
          WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent'
        }}>AGE OF SHADOWS</h1>
        <p style={{color:'rgba(255,255,255,0.5)', fontSize:'14px', letterSpacing:'6px', marginTop:'8px'}}>
          MULTIPLAYER STRATEGY
        </p>
      </div>

      {/* Login box */}
      <div style={{
        background:'rgba(0,0,0,0.7)', border:'1px solid rgba(200,168,75,0.4)',
        borderRadius:'16px', padding:'40px 48px', width:'360px', zIndex:1,
        backdropFilter:'blur(10px)', boxShadow:'0 0 60px rgba(200,168,75,0.1)'
      }}>
        <h2 style={{margin:'0 0 24px', fontSize:'20px', color:'#c8a84b', textAlign:'center'}}>
          Enter the Realm
        </h2>

        <div style={{marginBottom:'20px'}}>
          <label style={{display:'block', fontSize:'12px', color:'rgba(255,255,255,0.6)', marginBottom:'8px', letterSpacing:'2px'}}>
            YOUR NAME
          </label>
          <input
            type="text"
            value={name}
            onChange={e=>setName(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&handleEnter()}
            placeholder="Enter your warrior name..."
            maxLength={20}
            autoFocus
            style={{
              width:'100%', padding:'12px 16px', background:'rgba(255,255,255,0.08)',
              border:'1px solid rgba(200,168,75,0.3)', borderRadius:'8px',
              color:'#fff', fontSize:'15px', outline:'none', boxSizing:'border-box',
              fontFamily:"'Segoe UI', sans-serif"
            }}
          />
          {error && <div style={{color:'#ff6b6b', fontSize:'12px', marginTop:'6px'}}>{error}</div>}
        </div>

        <button
          onClick={handleEnter}
          style={{
            width:'100%', padding:'14px', background:'linear-gradient(135deg, #c8a84b, #ffd700)',
            border:'none', borderRadius:'8px', color:'#000', fontSize:'16px',
            fontWeight:'700', cursor:'pointer', letterSpacing:'2px',
            transition:'all 0.2s', fontFamily:"'Segoe UI', sans-serif"
          }}
          onMouseEnter={e=>e.target.style.transform='scale(1.02)'}
          onMouseLeave={e=>e.target.style.transform='scale(1)'}
        >
          ENTER GAME
        </button>

        <div style={{marginTop:'20px', textAlign:'center', fontSize:'11px', color:'rgba(255,255,255,0.3)'}}>
          Free to play · No download required
        </div>
      </div>

      {/* Bottom credits */}
      <div style={{position:'absolute', bottom:'20px', fontSize:'11px', color:'rgba(255,255,255,0.2)', zIndex:1}}>
        © 2026 CryptoWorldGames · ageofshadows.onrender.com
      </div>
    </div>
  );
}

export default function App() {
  const [playerName, setPlayerName] = useState(null);

  if (!playerName) {
    return <SplashScreen onEnter={setPlayerName} />;
  }

  return <GameScene playerName={playerName} />;
}