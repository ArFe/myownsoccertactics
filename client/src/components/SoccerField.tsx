import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import Draggable from 'react-draggable';
import soccerFieldBg from '../assets/soccer field background 1003.jpg';
import soccerBall from '../assets/ball.svg';
import SettingsMenu from './SettingsMenu';
import PlaysList, { Play } from './PlaysList';
import useLocalStorage from '../hooks/useLocalStorage';
import { default442Positions } from '../utils/formations';
import { useRecording } from '../hooks/useRecording';
import { usePlayback } from '../hooks/usePlayback';

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

const RecordButton = styled.button`
  position: fixed;
  bottom: 20px;
  right: 20px;
  background-color: #e74c3c;
  color: white;
  border: none;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 1000;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  transition: all 0.2s;
  font-size: 24px;

  &:hover {
    background-color: #c0392b;
    transform: scale(1.1);
  }

  &.recording {
    background-color: #2ecc71;
    animation: pulse 1.5s infinite;

    &:hover {
      background-color: #27ae60;
    }
  }

  @keyframes pulse {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.1);
    }
    100% {
      transform: scale(1);
    }
  }
`;

export interface PlayerPosition {
  x: number;
  y: number;
}

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
  const [isPlaysOpen, setIsPlaysOpen] = useState(false);
  const [fieldSize, setFieldSize] = useState({ width: 0, height: 0 });
  const [ballPosition, setBallPosition] = useLocalStorage<PlayerPosition>('ballPosition', { x: 0, y: 0 });
  const [currentSettings, setCurrentSettings] = useLocalStorage<Settings>('fieldSettings', settings);
  const [storedHomeTeam, setStoredHomeTeam] = useLocalStorage<PlayerPosition[]>('homeTeam', homeTeam || []);
  const [storedAwayTeam, setStoredAwayTeam] = useLocalStorage<PlayerPosition[]>('awayTeam', awayTeam || []);
  const [plays, setPlays] = useLocalStorage<Play[]>('plays', []);
  const fieldRef = useRef<HTMLDivElement>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const currentPlayRef = useRef<Play | null>(null);

  const { isRecording, startRecording, stopRecording } = useRecording({
    homeTeam: storedHomeTeam,
    awayTeam: storedAwayTeam,
    ballPosition,
    onRecord: (movements) => {
      const newPlay: Play = {
        id: Date.now().toString(),
        name: `Play ${plays.length + 1}`,
        description: `Recorded on ${new Date().toLocaleString()}`,
        homeTeam: storedHomeTeam,
        awayTeam: storedAwayTeam,
        ballPosition: ballPosition,
        movements: movements
      };

      console.log('Created new play:', newPlay);
      setPlays((prev: Play[]): Play[] => [...prev, newPlay]);
    }
  });

  const {
    isPlaying,
    currentTime,
    duration,
    currentIndex,
    totalNumberOfPlays,
    playbackSpeed,
    startPlayback,
    pausePlayback,
    stopPlayback,
    seekTo,
    setSpeed
  } = usePlayback({
    play: currentPlayRef.current,
    onPositionUpdate: (homeTeam, awayTeam, ballPosition) => {
      console.log('Updating positions:', { homeTeam, awayTeam, ballPosition });
      setStoredHomeTeam([...homeTeam]);
      setStoredAwayTeam([...awayTeam]);
      setBallPosition(ballPosition);
    }
  });

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
      setStoredHomeTeam(prev => {
        const newHomeTeam = [...prev];
        newHomeTeam[index] = relativePos;
        console.log('Updated home team position:', newHomeTeam);
        return newHomeTeam;
      });
    } else {
      setStoredAwayTeam(prev => {
        const newAwayTeam = [...prev];
        newAwayTeam[index] = relativePos;
        console.log('Updated away team position:', newAwayTeam);
        return newAwayTeam;
      });
    }
  };

  const handleBallMove = (x: number, y: number) => {
    const relativePos = getRelativePosition(x, y);
    setBallPosition(relativePos);
    console.log('Updated ball position:', relativePos);
    if (onBallMove) {
      onBallMove(relativePos);
    }
  };

  const handleSettingsChange = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setCurrentSettings((prev: Settings): Settings => {
      const newSettings = { ...prev, [key]: value };
      return newSettings;
    });
  };

  const handleRestoreDefaults = () => {
    console.log('Restoring defaults');
    console.log('Default home team:', default442Positions.homeTeam);
    console.log('Default away team:', default442Positions.awayTeam);

    // Reset settings to default values
    setCurrentSettings(defaultSettings);
    
    // Reset ball position to center
    setBallPosition({ x: 0, y: 0 });
    
    // Reset team positions to their default positions
    setStoredHomeTeam([...default442Positions.homeTeam]);
    setStoredAwayTeam([...default442Positions.awayTeam]);
    
    // Notify parent components of position changes
    default442Positions.homeTeam.forEach((pos, index) => onPlayerMove('home', index, pos));
    default442Positions.awayTeam.forEach((pos, index) => onPlayerMove('away', index, pos));
    if (onBallMove) {
      onBallMove({ x: 0, y: 0 });
    }
  };

  const handlePlaybackControl = (action: 'play' | 'pause' | 'stop' | 'seek' | 'speed', value?: number) => {
    console.log('Playback control:', action, value);
    switch (action) {
      case 'play':
        if (currentPlayRef.current) {
          startPlayback();
        }
        break;
      case 'pause':
        pausePlayback();
        console.log("currentIndex", currentIndex);
        console.log("totalNumberOfPlays", totalNumberOfPlays);
        console.log("currentPlayRef.current", currentPlayRef.current);
        break;
      case 'stop':
        stopPlayback();
        break;
      case 'seek':
        if (value !== undefined && currentPlayRef.current) {
          seekTo(value);
        }
        break;
      case 'speed':
        if (value !== undefined) {
          setSpeed(value);
        }
        break;
    }
  };

  const handlePlaySelect = (play: Play) => {
    console.log('Selecting play:', play);
    currentPlayRef.current = play;
    stopPlayback();
    // Reset positions to the first frame
    if (play.movements) {
      setStoredHomeTeam([...play.movements.homeTeam[0]]);
      setStoredAwayTeam([...play.movements.awayTeam[0]]);
      setBallPosition(play.movements.ballPosition[0]);
    }
  };

  const handlePlayDelete = (playId: string) => {
    setPlays((prev) => prev.filter(play => play.id !== playId));
  };

  const handleDeleteAllPlays = () => {
    if (window.confirm('Are you sure you want to delete all plays? This action cannot be undone.')) {
      setPlays([]);
    }
  };

  return (
    <>
      <PlaysList
        isOpen={isPlaysOpen}
        onToggle={() => setIsPlaysOpen(!isPlaysOpen)}
        plays={plays}
        onPlaySelect={handlePlaySelect}
        onPlayDelete={handlePlayDelete}
        onDeleteAll={handleDeleteAllPlays}
        onPlaybackControl={handlePlaybackControl}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        currentIndex={currentIndex}
        totalNumberOfPlays={totalNumberOfPlays}
        playbackSpeed={playbackSpeed}
      />
      <SettingsButton onClick={() => setIsMenuOpen(!isMenuOpen)}>
        ⚙️
      </SettingsButton>
      <RecordButton
        className={isRecording ? 'recording' : ''}
        onClick={isRecording ? stopRecording : startRecording}
      >
        {isRecording ? '⏺' : '➕'}
      </RecordButton>
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
          {storedHomeTeam?.map((player, index) => (
            <Draggable
              key={`home-${index}`}
              position={getAbsolutePosition(player)}
              onDrag={(e, data) => handlePlayerMove('home', index, data.x, data.y)}
              bounds="parent"
            >
              <Player color={currentSettings.homeColor} fieldSize={fieldSize} size={currentSettings.playerSize}>{index + 1}</Player>
            </Draggable>
          ))}
          {storedAwayTeam?.map((player, index) => (
            <Draggable
              key={`away-${index}`}
              position={getAbsolutePosition(player)}
              onDrag={(e, data) => handlePlayerMove('away', index, data.x, data.y)}
              bounds="parent"
            >
              <Player color={currentSettings.awayColor} fieldSize={fieldSize} size={currentSettings.playerSize}>{index + 1}</Player>
            </Draggable>
          ))}
          <Draggable
            position={getAbsolutePosition(ballPosition)}
            onDrag={(e, data) => handleBallMove(data.x, data.y)}
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
