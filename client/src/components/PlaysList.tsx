import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { PlayerPosition } from './SoccerField';

const PlaysContainer = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: ${props => props.isOpen ? '0' : '-300px'};
  width: 300px;
  height: 100vh;
  background-color: #2c3e50;
  color: #ecf0f1;
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
  transition: left 0.3s ease-in-out;
  padding: 20px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
`;

const ToggleButton = styled.button`
  position: absolute;
  top: 20px;
  right: -40px;
  background-color: #2c3e50;
  color: #ecf0f1;
  border: none;
  border-radius: 0 4px 4px 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
  transition: background-color 0.2s;

  &:hover {
    background-color: #34495e;
  }
`;

const Title = styled.h2`
  margin: 0 0 20px 0;
  color: #ecf0f1;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const PlayList = styled.div`
  flex: 1;
  overflow-y: auto;
`;

const PlayItem = styled.div<{ selected: boolean }>`
  padding: 10px;
  margin-bottom: 10px;
  background-color: ${props => props.selected ? '#2980b9' : '#34495e'};
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
  display: flex;
  justify-content: space-between;
  align-items: center;

  &:hover {
    background-color: ${props => props.selected ? '#3498db' : '#2c3e50'};
  }
`;

const PlayName = styled.div`
  font-weight: bold;
  margin-bottom: 5px;
`;

const PlayDescription = styled.div`
  font-size: 14px;
  color: #bdc3c7;
`;

const DeleteButton = styled.button`
  background-color: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 12px;
  transition: background-color 0.2s;

  &:hover {
    background-color: #c0392b;
  }
`;

const DeleteAllButton = styled.button`
  background-color: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;

  &:hover {
    background-color: #c0392b;
  }
`;

const PlayInfo = styled.div`
  flex: 1;
`;

const PlaybackControls = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  background-color: #34495e;
  border-radius: 4px;
  margin-top: 10px;
`;

const ControlsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const PlaybackButton = styled.button`
  background-color: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;

  &:hover {
    background-color: #2980b9;
  }

  &:disabled {
    background-color: #7f8c8d;
    cursor: not-allowed;
  }
`;

const TimeDisplay = styled.div`
  color: #ecf0f1;
  font-size: 14px;
  min-width: 80px;
  text-align: center;
`;

const Slider = styled.input`
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  background: #7f8c8d;
  border-radius: 2px;
  outline: none;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    background: #3498db;
    border-radius: 50%;
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: #2980b9;
    }
  }
`;

export interface Play {
  id: string;
  name: string;
  description: string;
  homeTeam: PlayerPosition[];
  awayTeam: PlayerPosition[];
  ballPosition: PlayerPosition;
  movements?: {
    homeTeam: PlayerPosition[][];
    awayTeam: PlayerPosition[][];
    ballPosition: PlayerPosition[];
  };
}

interface PlaysListProps {
  isOpen: boolean;
  onToggle: () => void;
  plays: Play[];
  onPlaySelect: (play: Play) => void;
  onPlayDelete: (playId: string) => void;
  onDeleteAll: () => void;
  onPlaybackControl: (action: 'play' | 'pause' | 'stop' | 'seek' | 'speed', value?: number) => void;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackSpeed: number;
  currentIndex: number;
  totalNumberOfPlays: number;
}

const PlaysList: React.FC<PlaysListProps> = ({
  isOpen,
  onToggle,
  plays,
  onPlaySelect,
  onPlayDelete,
  onDeleteAll,
  onPlaybackControl,
  isPlaying,
  currentTime,
  duration,
  currentIndex,
  totalNumberOfPlays,
  playbackSpeed,
}) => {
  const [selectedPlayId, setSelectedPlayId] = useState<string | null>(null);
  const sliderRef = useRef<HTMLInputElement>(null);

  const handlePlaySelect = (play: Play) => {
    setSelectedPlayId(play.id);
    onPlaySelect(play);
  };

  const handlePlayDelete = (playId: string) => {
    if (selectedPlayId === playId) {
      setSelectedPlayId(null);
    }
    onPlayDelete(playId);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    onPlaybackControl('seek', value);
  };

  return (
    <PlaysContainer isOpen={isOpen}>
      <ToggleButton onClick={onToggle}>
        {isOpen ? '◀' : '▶'}
      </ToggleButton>
      <Title>
        Plays
        {plays.length > 0 && (
          <DeleteAllButton onClick={onDeleteAll}>
            Delete All
          </DeleteAllButton>
        )}
      </Title>
      <PlayList>
        {plays.map((play) => (
          <PlayItem
            key={play.id}
            selected={selectedPlayId === play.id}
            onClick={() => handlePlaySelect(play)}
          >
            <PlayInfo>
              <PlayName>{play.name}</PlayName>
              <PlayDescription>{play.description}</PlayDescription>
            </PlayInfo>
            <DeleteButton
              onClick={(e) => {
                e.stopPropagation();
                handlePlayDelete(play.id);
              }}
            >
              ×
            </DeleteButton>
          </PlayItem>
        ))}
      </PlayList>
      {selectedPlayId && (
        <PlaybackControls>
          <ControlsRow>
            <PlaybackButton
              onClick={() => onPlaybackControl('play')}
              disabled={isPlaying}
            >
              ▶
            </PlaybackButton>
            <PlaybackButton
              onClick={() => onPlaybackControl('pause')}
              disabled={!isPlaying}
            >
              ⏸
            </PlaybackButton>
            <PlaybackButton
              onClick={() => onPlaybackControl('stop')}
              disabled={!isPlaying && currentTime === 0}
            >
              ⏹
            </PlaybackButton>
            <select
              value={playbackSpeed}
              onChange={(e) => onPlaybackControl('speed', Number(e.target.value))}
              className="px-2 py-1 border rounded"
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={4}>4x</option>
            </select>
            <TimeDisplay>
              {formatTime(currentTime)} / {formatTime(duration)}
            </TimeDisplay>
          </ControlsRow>
          <ControlsRow>
            <Slider
              type="range"
              min={0}
              max={totalNumberOfPlays - 1}
              value={currentIndex}
              onChange={handleSliderChange}
              ref={sliderRef}
            />
          </ControlsRow>
        </PlaybackControls>
      )}
    </PlaysContainer>
  );
};

export default PlaysList; 
