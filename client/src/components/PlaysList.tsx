import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { PlayerPosition } from './SoccerField';

const PlaysContainer = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: ${props => props.isOpen ? '0' : '-400px'};
  width: 400px;
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

const PlaysContent = styled.div`
  flex: 1;
  overflow-y: auto;
  margin-top: 20px;
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

const MenuSection = styled.div`
  margin-bottom: 10px;
`;

const MenuHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px;
  background-color: #34495e;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: #2c3e50;
  }
`;

const MenuTitle = styled.h3`
  margin: 0;
  color: #ecf0f1;
  font-size: 16px;
`;

const MenuContent = styled.div<{ isOpen: boolean }>`
  max-height: ${props => props.isOpen ? '500px' : '0'};
  overflow: hidden;
  transition: max-height 0.3s ease-in-out;
  background-color: #2c3e50;
  border-radius: 0 0 4px 4px;
  padding: ${props => props.isOpen ? '10px' : '0'};
  opacity: ${props => props.isOpen ? '1' : '0'};
  transition: max-height 0.3s ease-in-out, opacity 0.3s ease-in-out, padding 0.3s ease-in-out;
`;

const ChevronIcon = styled.span<{ isOpen: boolean }>`
  display: inline-block;
  transition: transform 0.3s ease;
  transform: rotate(${props => props.isOpen ? '90deg' : '0deg'});
`;

const TabContainer = styled.div`
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
`;

const TabButton = styled.button<{ active: boolean }>`
  flex: 1;
  padding: 10px;
  background-color: ${props => props.active ? '#3498db' : '#34495e'};
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: ${props => props.active ? '#2980b9' : '#2c3e50'};
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

const Dialog = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: #2c3e50;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  z-index: 2000;
  width: 300px;
`;

const DialogTitle = styled.h3`
  margin: 0 0 20px 0;
  color: #ecf0f1;
`;

const DialogInput = styled.input`
  width: 100%;
  padding: 8px;
  margin-bottom: 20px;
  border: 1px solid #34495e;
  border-radius: 4px;
  background-color: #34495e;
  color: #ecf0f1;
  font-size: 14px;

  &:focus {
    outline: none;
    border-color: #3498db;
  }
`;

const DialogButtons = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
`;

const DialogButton = styled.button`
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;

  &.primary {
    background-color: #3498db;
    color: white;

    &:hover {
      background-color: #2980b9;
    }
  }

  &.secondary {
    background-color: #34495e;
    color: #ecf0f1;

    &:hover {
      background-color: #2c3e50;
    }
  }
`;

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1999;
`;

const PositionButtons = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
`;

const PositionButton = styled.button<{ type: 'home' | 'away' | 'both'; homeColor: string; awayColor: string }>`
  width: 100%;
  padding: 12px;
  margin: 4px 0;
  border: 1px solid white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  text-align: left;
  transition: all 0.2s ease;
  background-color: ${props => {
    if (props.type === 'home') return `${props.homeColor}33`;
    if (props.type === 'away') return `${props.awayColor}33`;
    if (props.type === 'both') {
      const homeRgb = hexToRgb(props.homeColor);
      const awayRgb = hexToRgb(props.awayColor);
      return `rgba(${(homeRgb.r + awayRgb.r) / 2}, ${(homeRgb.g + awayRgb.g) / 2}, ${(homeRgb.b + awayRgb.b) / 2}, 0.2)`;
    }
    return 'transparent';
  }};
  color: #ecf0f1;

  &:hover {
    background-color: ${props => {
      if (props.type === 'home') return `${props.homeColor}66`;
      if (props.type === 'away') return `${props.awayColor}66`;
      if (props.type === 'both') {
        const homeRgb = hexToRgb(props.homeColor);
        const awayRgb = hexToRgb(props.awayColor);
        return `rgba(${(homeRgb.r + awayRgb.r) / 2}, ${(homeRgb.g + awayRgb.g) / 2}, ${(homeRgb.b + awayRgb.b) / 2}, 0.4)`;
      }
      return '#2c3e50';
    }};
  }
`;

const PositionItem = styled.div<{ isSelected: boolean; type: 'home' | 'away' | 'both'; homeColor: string; awayColor: string }>`
  padding: 8px;
  margin: 4px 0;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: ${props => {
    if (props.isSelected) return '#2c3e50';
    if (props.type === 'home') return `${props.homeColor}33`;
    if (props.type === 'away') return `${props.awayColor}33`;
    if (props.type === 'both') {
      const homeRgb = hexToRgb(props.homeColor);
      const awayRgb = hexToRgb(props.awayColor);
      return `rgba(${(homeRgb.r + awayRgb.r) / 2}, ${(homeRgb.g + awayRgb.g) / 2}, ${(homeRgb.b + awayRgb.b) / 2}, 0.2)`;
    }
    return 'transparent';
  }};
  border: 1px solid white;
  transition: all 0.2s ease;

  &:hover {
    background-color: ${props => {
      if (props.isSelected) return '#2c3e50';
      if (props.type === 'home') return `${props.homeColor}66`;
      if (props.type === 'away') return `${props.awayColor}66`;
      if (props.type === 'both') {
        const homeRgb = hexToRgb(props.homeColor);
        const awayRgb = hexToRgb(props.awayColor);
        return `rgba(${(homeRgb.r + awayRgb.r) / 2}, ${(homeRgb.g + awayRgb.g) / 2}, ${(homeRgb.b + awayRgb.b) / 2}, 0.4)`;
      }
      return '#2c3e50';
    }};
  }
`;

// Helper function to convert hex to RGB
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
};

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

export interface Position {
  id: string;
  name: string;
  description: string;
  homeTeam: PlayerPosition[];
  awayTeam: PlayerPosition[];
  type: 'home' | 'away' | 'both';
}

interface PlaysListProps {
  isOpen: boolean;
  onToggle: () => void;
  plays: Play[];
  positions: Position[];
  onPlaySelect: (play: Play) => void;
  onPositionSelect: (position: Position) => void;
  onPlayDelete: (playId: string) => void;
  onPositionDelete: (positionId: string) => void;
  onDeleteAll: () => void;
  onPlaybackControl: (action: 'play' | 'pause' | 'stop' | 'seek' | 'speed', value?: number) => void;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  currentIndex: number;
  totalNumberOfPlays: number;
  playbackSpeed: number;
  onSavePosition: (name: string, type: 'home' | 'away' | 'both') => void;
  homeColor: string;
  awayColor: string;
}

const NamePositionDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  defaultName: string;
}> = ({
  isOpen,
  onClose,
  onSave,
  defaultName
}) => {
  const [name, setName] = useState(defaultName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim());
      setName(defaultName);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <Overlay onClick={onClose} />
      <Dialog>
        <DialogTitle>Name Position</DialogTitle>
        <DialogInput
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter position name"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSave();
            }
          }}
        />
        <DialogButtons>
          <DialogButton className="secondary" onClick={onClose}>
            Cancel
          </DialogButton>
          <DialogButton className="primary" onClick={handleSave}>
            Save
          </DialogButton>
        </DialogButtons>
      </Dialog>
    </>
  );
};

const PlaysList: React.FC<PlaysListProps> = ({
  isOpen,
  onToggle,
  plays,
  positions,
  onPlaySelect,
  onPositionSelect,
  onPlayDelete,
  onPositionDelete,
  onDeleteAll,
  onPlaybackControl,
  isPlaying,
  currentTime,
  duration,
  currentIndex,
  totalNumberOfPlays,
  playbackSpeed,
  onSavePosition,
  homeColor,
  awayColor
}) => {
  const [selectedPlayId, setSelectedPlayId] = useState<string | null>(null);
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<'plays' | 'positions' | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [positionType, setPositionType] = useState<'home' | 'away' | 'both'>('both');
  const sliderRef = useRef<HTMLInputElement>(null);

  const handlePlaySelect = (play: Play) => {
    setSelectedPlayId(play.id);
    setSelectedPositionId(null);
    onPlaySelect(play);
  };

  const handlePositionSelect = (position: Position) => {
    setSelectedPositionId(position.id);
    setSelectedPlayId(null);
    onPositionSelect(position);
  };

  const handlePlayDelete = (playId: string) => {
    if (selectedPlayId === playId) {
      setSelectedPlayId(null);
    }
    onPlayDelete(playId);
  };

  const handlePositionDelete = (positionId: string) => {
    if (selectedPositionId === positionId) {
      setSelectedPositionId(null);
    }
    onPositionDelete(positionId);
  };

  const toggleSection = (section: 'plays' | 'positions') => {
    setOpenSection(openSection === section ? null : section);
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

  const handleSavePosition = (name: string) => {
    onSavePosition(name, positionType);
    setIsDialogOpen(false);
  };

  return (
    <PlaysContainer isOpen={isOpen}>
      <ToggleButton onClick={onToggle}>
        ☰
      </ToggleButton>
      <PlaysContent>
        <MenuSection>
          <MenuHeader onClick={() => toggleSection('plays')}>
            <MenuTitle>Plays</MenuTitle>
            <ChevronIcon isOpen={openSection === 'plays'}>▼</ChevronIcon>
          </MenuHeader>
          <MenuContent isOpen={openSection === 'plays'}>
            {plays.length > 0 && (
              <DeleteAllButton onClick={onDeleteAll}>
                Delete All
              </DeleteAllButton>
            )}
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
          </MenuContent>
        </MenuSection>
        <MenuSection>
          <MenuHeader onClick={() => toggleSection('positions')}>
            <MenuTitle>Positions</MenuTitle>
            <ChevronIcon isOpen={openSection === 'positions'}>▼</ChevronIcon>
          </MenuHeader>
          <MenuContent isOpen={openSection === 'positions'}>
            <PositionButtons>
              <PositionButton 
                type="home"
                homeColor={homeColor}
                awayColor={awayColor}
                onClick={() => {
                  setPositionType('home');
                  setIsDialogOpen(true);
                }}
              >
                Save Home Positions
              </PositionButton>
              <PositionButton 
                type="away"
                homeColor={homeColor}
                awayColor={awayColor}
                onClick={() => {
                  setPositionType('away');
                  setIsDialogOpen(true);
                }}
              >
                Save Away Positions
              </PositionButton>
              <PositionButton 
                type="both"
                homeColor={homeColor}
                awayColor={awayColor}
                onClick={() => {
                  setPositionType('both');
                  setIsDialogOpen(true);
                }}
              >
                Save Both Positions
              </PositionButton>
            </PositionButtons>
            {positions.length > 0 && (
              <DeleteAllButton onClick={onDeleteAll}>
                Delete All
              </DeleteAllButton>
            )}
            <PlayList>
              {positions.map((position) => (
                <PositionItem
                  key={position.id}
                  isSelected={selectedPositionId === position.id}
                  type={position.type}
                  homeColor={homeColor}
                  awayColor={awayColor}
                  onClick={() => handlePositionSelect(position)}
                >
                  <div>
                    <div>{position.name}</div>
                    <div style={{ fontSize: '0.8em', color: '#666' }}>{position.description}</div>
                  </div>
                  <DeleteButton
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePositionDelete(position.id);
                    }}
                  >
                    ×
                  </DeleteButton>
                </PositionItem>
              ))}
            </PlayList>
          </MenuContent>
        </MenuSection>
      </PlaysContent>
      {isDialogOpen && (
        <NamePositionDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          onSave={handleSavePosition}
          defaultName={`Position ${positions.length + 1}`}
        />
      )}
    </PlaysContainer>
  );
};

export default PlaysList;
