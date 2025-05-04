import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
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

const Canvas = styled.canvas`
  position: absolute;
  width: 100%;
  height: 100%;
  z-index: 1;
  pointer-events: auto;
  background-image: url(${soccerFieldBg});
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;
`;

const FieldContent = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background-image: url(${soccerFieldBg});
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;
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
  ballPosition: PlayerPosition;
  onPlayerMove: (team: 'home' | 'away', index: number, position: PlayerPosition) => void;
  onBallMove?: (position: PlayerPosition) => void;
  settings?: Settings;
}

const SoccerField: React.FC<SoccerFieldProps> = ({
  homeTeam,
  awayTeam,
  ballPosition,
  onPlayerMove,
  onBallMove,
  settings = defaultSettings
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPlaysOpen, setIsPlaysOpen] = useState(false);
  const [fieldSize, setFieldSize] = useState({ width: 0, height: 0 });
  const [localBallPosition, setLocalBallPosition] = useLocalStorage<PlayerPosition>('ballPosition', ballPosition);
  const [currentSettings, setCurrentSettings] = useLocalStorage<Settings>('fieldSettings', settings);
  const [storedHomeTeam, setStoredHomeTeam] = useLocalStorage<PlayerPosition[]>('homeTeam', homeTeam || []);
  const [storedAwayTeam, setStoredAwayTeam] = useLocalStorage<PlayerPosition[]>('awayTeam', awayTeam || []);
  const [plays, setPlays] = useLocalStorage<Play[]>('plays', []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const currentPlayRef = useRef<Play | null>(null);
  const isDraggingRef = useRef<{ type: 'player' | 'ball' | null; team: 'home' | 'away' | null; index: number | null }>({ type: null, team: null, index: null });


 
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
      // console.log('Updating positions:', { homeTeam, awayTeam, ballPosition });
      setStoredHomeTeam([...homeTeam]);
      setStoredAwayTeam([...awayTeam]);
      setLocalBallPosition(ballPosition);
    }
  });

  // Load the image to get its dimensions
  useEffect(() => {
    const img = new Image();
    img.src = soccerFieldBg;
    img.onload = () => {
      setImageSize({ width: img.width, height: img.height });
    };
  }, []);

  useEffect(() => {
    const updateFieldSize = () => {
      if (canvasRef.current && imageSize.width > 0) {
        const container = canvasRef.current.parentElement;
        if (!container) return;

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

        // Set the canvas size to match the field image exactly
        canvasRef.current.style.width = `${width}px`;
        canvasRef.current.style.height = `${height}px`;
        canvasRef.current.width = width;
        canvasRef.current.height = height;

        setFieldSize({ width, height });
        drawField();
      }
    };

    window.addEventListener('resize', updateFieldSize);
    updateFieldSize();

    return () => window.removeEventListener('resize', updateFieldSize);
  }, [imageSize]);

  useEffect(() => {
    drawField();
  }, [storedHomeTeam, storedAwayTeam, localBallPosition, currentSettings, fieldSize]);

  const drawField = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    const bgImg = new Image();
    bgImg.src = soccerFieldBg;
    bgImg.onload = () => {
      ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
      
      // Draw players
      const drawPlayer = (x: number, y: number, color: string, number: number) => {
        const size = Math.min(fieldSize.width, fieldSize.height) * getSizePercentage(currentSettings.playerSize, 'player');
        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw player number
        ctx.fillStyle = 'white';
        ctx.font = `${size * 0.5}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(number.toString(), x, y);
      };

      // Draw home team
      storedHomeTeam.forEach((player, index) => {
        const { x, y } = getAbsolutePosition(player);
        drawPlayer(x, y, currentSettings.homeColor, index + 1);
      });

      // Draw away team
      storedAwayTeam.forEach((player, index) => {
        const { x, y } = getAbsolutePosition(player);
        drawPlayer(x, y, currentSettings.awayColor, index + 1);
      });

      // Draw ball
      const ballSize = Math.min(fieldSize.width, fieldSize.height) * getSizePercentage(currentSettings.ballSize, 'ball');
      const { x, y } = getAbsolutePosition(localBallPosition);
      const ballImg = new Image();
      ballImg.src = soccerBall;
      ballImg.onload = () => {
        ctx.drawImage(ballImg, x - ballSize / 2, y - ballSize / 2, ballSize, ballSize);
      };
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const relativePos = getRelativePosition(x, y);

    // Check if clicked on a player or ball
    const playerSize = Math.min(fieldSize.width, fieldSize.height) * getSizePercentage(currentSettings.playerSize, 'player');
    const ballSize = Math.min(fieldSize.width, fieldSize.height) * getSizePercentage(currentSettings.ballSize, 'ball');

    // Check home team
    for (let i = 0; i < storedHomeTeam.length; i++) {
      const playerPos = getAbsolutePosition(storedHomeTeam[i]);
      const distance = Math.sqrt(Math.pow(x - playerPos.x, 2) + Math.pow(y - playerPos.y, 2));
      if (distance <= playerSize / 2) {
        isDraggingRef.current = { type: 'player', team: 'home', index: i };
        return;
      }
    }

    // Check away team
    for (let i = 0; i < storedAwayTeam.length; i++) {
      const playerPos = getAbsolutePosition(storedAwayTeam[i]);
      const distance = Math.sqrt(Math.pow(x - playerPos.x, 2) + Math.pow(y - playerPos.y, 2));
      if (distance <= playerSize / 2) {
        isDraggingRef.current = { type: 'player', team: 'away', index: i };
        return;
      }
    }

    // Check ball
    const ballPos = getAbsolutePosition(localBallPosition);
    const ballDistance = Math.sqrt(Math.pow(x - ballPos.x, 2) + Math.pow(y - ballPos.y, 2));
    if (ballDistance <= ballSize / 2) {
      isDraggingRef.current = { type: 'ball', team: null, index: null };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current.type) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const relativePos = getRelativePosition(x, y);

    if (isDraggingRef.current.type === 'player' && isDraggingRef.current.team && isDraggingRef.current.index !== null) {
      handlePlayerMove(isDraggingRef.current.team, isDraggingRef.current.index, x, y);
    } else if (isDraggingRef.current.type === 'ball') {
      handleBallMove(x, y);
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = { type: null, team: null, index: null };
  };

  // Convert relative position (-0.5 to 0.5) to absolute pixel position
  const getAbsolutePosition = (pos: PlayerPosition) => {
    const fieldWidth = fieldSize.width;
    const fieldHeight = fieldSize.height;
    
    // Calculate the center point of the field
    const centerX = fieldWidth / 2;
    const centerY = fieldHeight / 2;
    
    // Calculate the position relative to the center
    // x and y are in range -0.5 to 0.5, where 0 is center
    const x = centerX + (pos.x * fieldWidth);
    const y = centerY + (pos.y * fieldHeight);
    
    // Ensure positions are within the field boundaries
    return {
      x: Math.max(0, Math.min(fieldWidth, x)),
      y: Math.max(0, Math.min(fieldHeight, y))
    };
  };

  // Convert absolute pixel position to relative position (-0.5 to 0.5)
  const getRelativePosition = (x: number, y: number): PlayerPosition => {
    const fieldWidth = fieldSize.width;
    const fieldHeight = fieldSize.height;
    
    // Calculate the center point of the field
    const centerX = fieldWidth / 2;
    const centerY = fieldHeight / 2;
    
    // Calculate the relative position from the center
    const relativeX = (x - centerX) / fieldWidth;
    const relativeY = (y - centerY) / fieldHeight;
    
    // Clamp to field boundaries and ensure proper scaling
    return {
      x: Math.max(-0.5, Math.min(0.5, relativeX)),
      y: Math.max(-0.5, Math.min(0.5, relativeY))
    };
  };

  const handlePlayerMove = (team: 'home' | 'away', index: number, x: number, y: number) => {
    const relativePos = getRelativePosition(x, y);
    onPlayerMove(team, index, relativePos);
    
    if (team === 'home') {
      setStoredHomeTeam(prev => {
        const newTeam = [...prev];
        newTeam[index] = relativePos;
        return newTeam;
      });
    } else {
      setStoredAwayTeam(prev => {
        const newTeam = [...prev];
        newTeam[index] = relativePos;
        return newTeam;
      });
    }
  };

  const handleBallMove = (x: number, y: number) => {
    const relativePos = getRelativePosition(x, y);
    setLocalBallPosition(relativePos);
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
    setLocalBallPosition({ x: 0, y: 0 });
    
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
      setLocalBallPosition(play.movements.ballPosition[0]);
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
      <SettingsButton onClick={() => setIsMenuOpen(true)}>
        ⚙️
      </SettingsButton>
      <RecordButton
        className={isRecording ? 'recording' : ''}
        onClick={isRecording ? stopRecording : startRecording}
      >
        {isRecording ? '⏺' : '⏺'}
      </RecordButton>
      {isMenuOpen && (
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
          onToggle={() => setIsMenuOpen(false)}
          onRestoreDefaults={handleRestoreDefaults}
        />
      )}
      <FieldContainer>
        <Canvas id="soccer-field"
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
        <Attribution>
          <AttributionLink href="https://www.freepik.com/free-vector/soccer-field-background_1003.htm" target="_blank" rel="noopener noreferrer">
            Soccer field background by Freepik
          </AttributionLink>
        </Attribution>
      </FieldContainer>
    </>
  );
};

export default SoccerField; 
