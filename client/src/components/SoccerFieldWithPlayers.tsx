import React, { useState } from 'react';
import SoccerField from './SoccerField';
import { default442Positions } from '../utils/formations';
import { PlayerPosition } from './SoccerField';

const SoccerFieldWithPlayers: React.FC = () => {
  const [homeTeam, setHomeTeam] = useState<PlayerPosition[]>(default442Positions.homeTeam);
  const [awayTeam, setAwayTeam] = useState<PlayerPosition[]>(default442Positions.awayTeam);
  const [ballPosition, setBallPosition] = useState<PlayerPosition>(default442Positions.ball);

  const handlePlayerMove = (team: 'home' | 'away', index: number, position: PlayerPosition) => {
    if (team === 'home') {
      setHomeTeam(prev => {
        const newTeam = [...prev];
        newTeam[index] = position;
        return newTeam;
      });
    } else {
      setAwayTeam(prev => {
        const newTeam = [...prev];
        newTeam[index] = position;
        return newTeam;
      });
    }
  };

  const handleBallMove = (position: PlayerPosition) => {
    setBallPosition(position);
  };

  return (
    <SoccerField
      homeTeam={homeTeam}
      awayTeam={awayTeam}
      ballPosition={ballPosition}
      onPlayerMove={handlePlayerMove}
      onBallMove={handleBallMove}
    />
  );
};

export default SoccerFieldWithPlayers; 
