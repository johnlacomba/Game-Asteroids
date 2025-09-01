import React from 'react';

const TitleScreen = ({ onModeSelect }) => {
  const handleKeyPress = (e) => {
    if (e.key === '1') {
      onModeSelect('offline');
    } else if (e.key === '2') {
      onModeSelect('multiplayer');
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
        <div style={{ marginBottom: '20px' }}>Select Game Mode:</div>
        
        <div style={{ 
          padding: '20px',
          border: '2px solid #00FFFF',
          marginBottom: '20px',
          backgroundColor: 'rgba(0, 255, 255, 0.1)',
          cursor: 'pointer'
        }}
        onClick={() => onModeSelect('offline')}>
          <strong>1. OFFLINE MODE</strong>
          <div style={{ fontSize: '18px', color: '#CCCCCC', marginTop: '10px' }}>
            Classic single-player experience with power-ups and UFO swarms
          </div>
        </div>
        
        <div style={{ 
          padding: '20px',
          border: '2px solid #00FF00',
          backgroundColor: 'rgba(0, 255, 0, 0.1)',
          cursor: 'pointer'
        }}
        onClick={() => onModeSelect('multiplayer')}>
          <strong>2. MULTIPLAYER</strong>
          <div style={{ fontSize: '18px', color: '#CCCCCC', marginTop: '10px' }}>
            Play with friends online - server authoritative gameplay
          </div>
        </div>
      </div>
      
      <div style={{
        fontSize: '16px',
        color: '#AAAAAA',
        textAlign: 'center',
        lineHeight: '1.5'
      }}>
        Press <strong>1</strong> for Offline Mode or <strong>2</strong> for Multiplayer<br/>
        Click on a mode to select it
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