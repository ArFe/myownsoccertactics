import React from 'react';
import styled from 'styled-components';

const MenuContainer = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  right: ${props => props.isOpen ? '0' : '-300px'};
  width: 300px;
  height: 100vh;
  background-color: #2c3e50;
  color: #ecf0f1;
  box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1);
  transition: right 0.3s ease-in-out;
  padding: 20px;
  z-index: 1000;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 10px;
  right: 10px;
  background: none;
  border: none;
  font-size: 24px;
  color: #ecf0f1;
  cursor: pointer;
  
  &:hover {
    color: #bdc3c7;
  }
`;

const SettingGroup = styled.div`
  margin-bottom: 20px;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 10px;
  font-weight: bold;
  color: #ecf0f1;
  font-size: 16px;
`;

const RadioGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 10px;
`;

const RadioLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  background-color: #34495e;
  transition: background-color 0.2s;
  color: #ecf0f1;

  &:hover {
    background-color: #2c3e50;
  }
`;

const RadioInput = styled.input`
  margin: 0;
  cursor: pointer;
  accent-color: #3498db;
`;

const RadioText = styled.span`
  font-size: 14px;
  flex: 1;
  color: #ecf0f1;
`;

const ColorInput = styled.input`
  width: 100%;
  height: 40px;
  padding: 5px;
  border: 1px solid #34495e;
  border-radius: 4px;
  background-color: #34495e;
  cursor: pointer;
`;

const RestoreButton = styled.button`
  width: 100%;
  padding: 10px;
  background-color: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  margin-top: 20px;
  transition: background-color 0.2s;

  &:hover {
    background-color: #c0392b;
  }
`;

interface SettingsMenuProps {
  isOpen: boolean;
  playerSize: 'small' | 'medium' | 'large';
  ballSize: 'small' | 'medium' | 'large';
  homeColor: string;
  awayColor: string;
  onPlayerSizeChange: (size: 'small' | 'medium' | 'large') => void;
  onBallSizeChange: (size: 'small' | 'medium' | 'large') => void;
  onHomeColorChange: (color: string) => void;
  onAwayColorChange: (color: string) => void;
  onToggle: () => void;
  onRestoreDefaults: () => void;
}

const SettingsMenu: React.FC<SettingsMenuProps> = ({
  isOpen,
  playerSize,
  ballSize,
  homeColor,
  awayColor,
  onPlayerSizeChange,
  onBallSizeChange,
  onHomeColorChange,
  onAwayColorChange,
  onToggle,
  onRestoreDefaults,
}) => {
  return (
    <MenuContainer isOpen={isOpen}>
      <CloseButton onClick={onToggle}>×</CloseButton>
      <h2>Settings</h2>
      
      <SettingGroup>
        <Label>Player Size</Label>
        <RadioGroup>
          <RadioLabel>
            <RadioInput
              type="radio"
              name="playerSize"
              value="small"
              checked={playerSize === 'small'}
              onChange={(e) => onPlayerSizeChange(e.target.value as 'small' | 'medium' | 'large')}
            />
            <RadioText>Small</RadioText>
          </RadioLabel>
          <RadioLabel>
            <RadioInput
              type="radio"
              name="playerSize"
              value="medium"
              checked={playerSize === 'medium'}
              onChange={(e) => onPlayerSizeChange(e.target.value as 'small' | 'medium' | 'large')}
            />
            <RadioText>Medium</RadioText>
          </RadioLabel>
          <RadioLabel>
            <RadioInput
              type="radio"
              name="playerSize"
              value="large"
              checked={playerSize === 'large'}
              onChange={(e) => onPlayerSizeChange(e.target.value as 'small' | 'medium' | 'large')}
            />
            <RadioText>Large</RadioText>
          </RadioLabel>
        </RadioGroup>
      </SettingGroup>

      <SettingGroup>
        <Label>Ball Size</Label>
        <RadioGroup>
          <RadioLabel>
            <RadioInput
              type="radio"
              name="ballSize"
              value="small"
              checked={ballSize === 'small'}
              onChange={(e) => onBallSizeChange(e.target.value as 'small' | 'medium' | 'large')}
            />
            <RadioText>Small</RadioText>
          </RadioLabel>
          <RadioLabel>
            <RadioInput
              type="radio"
              name="ballSize"
              value="medium"
              checked={ballSize === 'medium'}
              onChange={(e) => onBallSizeChange(e.target.value as 'small' | 'medium' | 'large')}
            />
            <RadioText>Medium</RadioText>
          </RadioLabel>
          <RadioLabel>
            <RadioInput
              type="radio"
              name="ballSize"
              value="large"
              checked={ballSize === 'large'}
              onChange={(e) => onBallSizeChange(e.target.value as 'small' | 'medium' | 'large')}
            />
            <RadioText>Large</RadioText>
          </RadioLabel>
        </RadioGroup>
      </SettingGroup>

      <SettingGroup>
        <Label>Home Team Color</Label>
        <ColorInput
          type="color"
          value={homeColor}
          onChange={(e) => onHomeColorChange(e.target.value)}
        />
      </SettingGroup>

      <SettingGroup>
        <Label>Away Team Color</Label>
        <ColorInput
          type="color"
          value={awayColor}
          onChange={(e) => onAwayColorChange(e.target.value)}
        />
      </SettingGroup>

      <RestoreButton onClick={onRestoreDefaults}>
        Restore Defaults
      </RestoreButton>
    </MenuContainer>
  );
};

export default SettingsMenu; 
