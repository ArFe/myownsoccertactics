import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import Draggable from 'react-draggable';
import soccerFieldBg from '../assets/soccer field background 1003.jpg';
import soccerBall from '../assets/ball.svg';
import SettingsMenu from './SettingsMenu';
import useLocalStorage from '../hooks/useLocalStorage';

const FieldContainer = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  background-image: url(${soccerFieldBg});
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const FieldContent = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const Player = styled.div<{ color: string; fieldSize: { width: number; height: number }; size: 'small' | 'medium' | 'large' }>`
  width: ${props => {
    const fieldDimension = Math.min(props.fieldSize.width, props.fieldSize.height);
    return `${fieldDimension * getSizePercentage(props.size, 'player')}px`;
  }};
  height: ${props => {
    const fieldDimension = Math.min(props.fieldSize.width, props.fieldSize.height);
    return `${fieldDimension * getSizePercentage(props.size, 'player')}px`;
  }};
  background-color: ${props => props.color};
  border-radius: 50%;
  position: absolute;
  cursor: move;
  display: flex;
  justify-content: center;
  align-items: center;
  color: white;
  font-weight: bold;
  border: 2px solid white;
  z-index: 2;
  font-size: ${props => {
    const fieldDimension = Math.min(props.fieldSize.width, props.fieldSize.height);
    return `${fieldDimension * getSizePercentage(props.size, 'player') * 0.5}px`;
  }};
`;

const Ball = styled.div<{ fieldSize: { width: number; height: number }; size: 'small' | 'medium' | 'large' }>`
  width: ${props => {
    const fieldDimension = Math.min(props.fieldSize.width, props.fieldSize.height);
    return `${fieldDimension * getSizePercentage(props.size, 'ball')}px`;
  }};
  height: ${props => {
    const fieldDimension = Math.min(props.fieldSize.width, props.fieldSize.height);
    return `${fieldDimension * getSizePercentage(props.size, 'ball')}px`;
  }};
  background-image: url(${soccerBall});
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;
  border-radius: 50%;
  position: absolute;
  cursor: move;
  z-index: 2;
`;

const Attribution = styled.div`
  position: absolute;
  bottom: 10px;
  right: 10px;
  color: white;
  font-size: 12px;
  background-color: rgba(0, 0, 0, 0.5);
  padding: 5px;
  border-radius: 4px;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const AttributionLink = styled.a`
  color: white;
  text-decoration: underline;
  
  &:hover {
    color: #ccc;
  }
`;

const SettingsButton = styled.button`
  position: fixed;
  top: 20px;
  right: 20px;
  background-color: #333;
  color: white;
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 1000;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  transition: background-color 0.2s ease;

  &:hover {
    background-color: #444;
  }

  &:active {
    background-color: #222;
  }
`;

interface PlayerPosition {
  x: number;
  y: number;
}

export type { PlayerPosition };

interface Settings {
  playerSize: 'small' | 'medium' | 'large';
  ballSize: 'small' | 'medium' | 'large';
  homeColor: string;
  awayColor: string;
}

const defaultSettings: Settings = {
  playerSize: 'medium',
  ballSize: 'medium',
  homeColor: '#FF0000',
  awayColor: '#0000FF',
};

const getSizePercentage = (size: 'small' | 'medium' | 'large', type: 'player' | 'ball'): number => {
  if (type === 'player') {
    switch (size) {
      case 'small': return 0.03;  // 3%
      case 'medium': return 0.04; // 4%
      case 'large': return 0.05;  // 5%
    }
  } else {
    switch (size) {
      case 'small': return 0.02;  // 2%
      case 'medium': return 0.03; // 3%
      case 'large': return 0.04;  // 4%
    }
  }
};

interface SoccerFieldProps {
  homeTeam: PlayerPosition[];
  awayTeam: PlayerPosition[];
  onPlayerMove: (team: 'home' | 'away', index: number, position: PlayerPosition) => void;
  onBallMove?: (position: PlayerPosition) => void;
  settings?: Settings;
}

const SoccerField: React.FC<SoccerFieldProps> = ({
  homeTeam,
  awayTeam,
  onPlayerMove,
  onBallMove,
  settings = defaultSettings
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [fieldSize, setFieldSize] = useState({ width: 0, height: 0 });
  const [ballPosition, setBallPosition] = useLocalStorage<PlayerPosition>('ballPosition', { x: 0, y: 0 });
  const [currentSettings, setCurrentSettings] = useLocalStorage<Settings>('fieldSettings', settings);
  const [storedHomeTeam, setStoredHomeTeam] = useLocalStorage<PlayerPosition[]>('homeTeam', homeTeam);
  const [storedAwayTeam, setStoredAwayTeam] = useLocalStorage<PlayerPosition[]>('awayTeam', awayTeam);
  const fieldRef = useRef<HTMLDivElement>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    // Load the image to get its dimensions
    const img = new Image();
    img.src = soccerFieldBg;
    img.onload = () => {
      setImageSize({ width: img.width, height: img.height });
    };
  }, []);

  useEffect(() => {
    const updateFieldSize = () => {
      if (fieldRef.current && imageSize.width > 0) {
        const container = fieldRef.current;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const imageRatio = imageSize.width / imageSize.height;
        const containerRatio = containerWidth / containerHeight;

        let width, height;
        if (containerRatio > imageRatio) {
          // Container is wider than image
          height = containerHeight;
          width = height * imageRatio;
        } else {
          // Container is taller than image
          width = containerWidth;
          height = width / imageRatio;
        }

        setFieldSize({ width, height });
      }
    };

    updateFieldSize();
    window.addEventListener('resize', updateFieldSize);
    return () => window.removeEventListener('resize', updateFieldSize);
  }, [imageSize]);

  // Convert relative position (-0.5 to 0.5) to absolute pixel position
  const getAbsolutePosition = (pos: PlayerPosition) => {
    if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') {
      return { x: 0, y: 0 };
    }
    
    const fieldWidth = fieldSize.width;
    const fieldHeight = fieldSize.height;
    
    // Calculate the center point of the field
    const centerX = 0;
    const centerY = 0;
    
    // Calculate the position relative to the center
    // x and y are in range -0.5 to 0.5, where 0 is center
    const x = centerX + (pos.x * fieldWidth);
    const y = centerY + (pos.y * fieldHeight);
    
    return { x, y };
  };

  // Convert absolute pixel position to relative position (-0.5 to 0.5)
  const getRelativePosition = (x: number, y: number): PlayerPosition => {
    const fieldWidth = fieldSize.width;
    const fieldHeight = fieldSize.height;
    
    // Calculate the center point of the field
    const centerX = 0;
    const centerY = 0;
    
    // Calculate the relative position from the center
    const relativeX = (x - centerX) / fieldWidth;
    const relativeY = (y - centerY) / fieldHeight;
    
    // Clamp to field boundaries
    return {
      x: Math.max(-0.5, Math.min(0.5, relativeX)),
      y: Math.max(-0.5, Math.min(0.5, relativeY))
    };
  };

  const handlePlayerMove = (team: 'home' | 'away', index: number, x: number, y: number) => {
    const relativePos = getRelativePosition(x, y);
    onPlayerMove(team, index, relativePos);
    
    // Update stored positions
    if (team === 'home') {
      const newHomeTeam = [...storedHomeTeam];
      newHomeTeam[index] = relativePos;
      setStoredHomeTeam(newHomeTeam);
    } else {
      const newAwayTeam = [...storedAwayTeam];
      newAwayTeam[index] = relativePos;
      setStoredAwayTeam(newAwayTeam);
    }
  };

  const handleBallMove = (x: number, y: number) => {
    const relativePos = getRelativePosition(x, y);
    setBallPosition(relativePos);
    if (onBallMove) {
      onBallMove(relativePos);
    }
  };

  const handleSettingsChange = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setCurrentSettings((prev: Settings) => {
      const newSettings = { ...prev, [key]: value };
      return newSettings;
    });
  };

  const handleRestoreDefaults = () => {
    // Reset settings to default values
    setCurrentSettings(defaultSettings);
    
    // Reset ball position to center
    setBallPosition({ x: 0, y: 0 });
    
    // Reset team positions to their initial positions
    setStoredHomeTeam(homeTeam);
    setStoredAwayTeam(awayTeam);
    
    // Notify parent components of position changes
    homeTeam.forEach((pos, index) => onPlayerMove('home', index, pos));
    awayTeam.forEach((pos, index) => onPlayerMove('away', index, pos));
    if (onBallMove) {
      onBallMove({ x: 0, y: 0 });
    }
  };

  return (
    <>
      <SettingsButton onClick={() => setIsMenuOpen(!isMenuOpen)}>
        ⚙️
      </SettingsButton>
      <SettingsMenu
        isOpen={isMenuOpen}
        playerSize={currentSettings.playerSize}
        ballSize={currentSettings.ballSize}
        homeColor={currentSettings.homeColor}
        awayColor={currentSettings.awayColor}
        onPlayerSizeChange={(size) => handleSettingsChange('playerSize', size)}
        onBallSizeChange={(size) => handleSettingsChange('ballSize', size)}
        onHomeColorChange={(color) => handleSettingsChange('homeColor', color)}
        onAwayColorChange={(color) => handleSettingsChange('awayColor', color)}
        onToggle={() => setIsMenuOpen(!isMenuOpen)}
        onRestoreDefaults={handleRestoreDefaults}
      />
      <FieldContainer ref={fieldRef}>
        <FieldContent style={{ width: fieldSize.width, height: fieldSize.height }}>
          {storedHomeTeam.map((player, index) => (
            <Draggable
              key={`home-${index}`}
              position={getAbsolutePosition(player)}
              onStop={(e, data) => handlePlayerMove('home', index, data.x, data.y)}
              bounds="parent"
            >
              <Player color={currentSettings.homeColor} fieldSize={fieldSize} size={currentSettings.playerSize}>{index + 1}</Player>
            </Draggable>
          ))}
          {storedAwayTeam.map((player, index) => (
            <Draggable
              key={`away-${index}`}
              position={getAbsolutePosition(player)}
              onStop={(e, data) => handlePlayerMove('away', index, data.x, data.y)}
              bounds="parent"
            >
              <Player color={currentSettings.awayColor} fieldSize={fieldSize} size={currentSettings.playerSize}>{index + 1}</Player>
            </Draggable>
          ))}
          <Draggable
            position={getAbsolutePosition(ballPosition)}
            onStop={(e, data) => handleBallMove(data.x, data.y)}
            bounds="parent"
          >
            <Ball fieldSize={fieldSize} size={currentSettings.ballSize} />
          </Draggable>
        </FieldContent>
        <Attribution>
          <div>
            Field background by <AttributionLink href="https://www.vecteezy.com/vector-art/234128-soccer-field-background" target="_blank" rel="noopener noreferrer">Vecteezy</AttributionLink>
          </div>
          <div>
            Ball icon by <AttributionLink href="https://www.vecteezy.com/vector-art/550584-soccer-ball-vector-icon" target="_blank" rel="noopener noreferrer">Vecteezy</AttributionLink>
          </div>
        </Attribution>
      </FieldContainer>
    </>
  );
};

export default SoccerField; 
