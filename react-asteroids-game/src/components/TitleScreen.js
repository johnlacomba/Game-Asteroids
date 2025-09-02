import React, { useState } from 'react';

const TitleScreen = ({ onModeSelect }) => {
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);
  const startGame = () => {
    const finalName = name.trim().slice(0, 20) || 'Player';
    onModeSelect('multiplayer', finalName);
  };
  const handleKeyPress = (e) => {
    if (e.key === '1' || e.key === 'Enter') {
      startGame();
    }
  };

  React.useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'black',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      fontFamily: 'Arial, sans-serif',
      zIndex: 1000
    }}>
      <h1 style={{
        fontSize: '72px',
        marginBottom: '50px',
        textAlign: 'center',
        letterSpacing: '8px',
        textShadow: '0 0 20px #00FFFF'
      }}>
        ASTEROIDS
      </h1>
      
      <div style={{
        fontSize: '24px',
        textAlign: 'center',
        lineHeight: '2',
        marginBottom: '60px'
      }}>
        <div style={{ marginBottom: '20px' }}>Enter a name & press ENTER</div>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={() => setTouched(true)}
          maxLength={20}
          placeholder="Your name"
          style={{
            padding: '12px 16px',
            marginBottom: '25px',
            background: '#111',
            color: '#FFF',
            border: '2px solid #00FFFF',
            borderRadius: '4px',
            fontSize: '20px',
            textAlign: 'center',
            width: '320px',
            letterSpacing: '1px'
          }}
          onKeyDown={e => { if (e.key === 'Enter') startGame(); }}
        />
        {touched && name.trim().length === 0 && (
          <div style={{ color: '#FF6666', fontSize: '14px', marginBottom: '10px' }}>Name optional (defaults to Player)</div>
        )}
        <div style={{ 
          padding: '28px 32px',
          border: '2px solid #00FF00',
          backgroundColor: 'rgba(0, 255, 0, 0.12)',
          cursor: 'pointer',
          fontSize: '28px'
        }}
        onClick={startGame}>
          <strong>M U L T I P L A Y E R</strong>
          <div style={{ fontSize: '16px', color: '#CCCCCC', marginTop: '12px', letterSpacing: '1px' }}>
            Server authoritative Asteroids with power-ups & UFOs
          </div>
        </div>
      </div>
      
      <div style={{
        fontSize: '16px',
        color: '#AAAAAA',
        textAlign: 'center',
        lineHeight: '1.5'
      }}>
  Press <strong>Enter</strong> (or click) to begin Multiplayer
      </div>
      
      {/* Animated stars background */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        zIndex: -1
      }}>
        {[...Array(50)].map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: '2px',
              height: '2px',
              backgroundColor: 'white',
              borderRadius: '50%',
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `twinkle ${2 + Math.random() * 3}s infinite`,
              opacity: Math.random()
            }}
          />
        ))}
      </div>
      
      <style jsx>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default TitleScreen;