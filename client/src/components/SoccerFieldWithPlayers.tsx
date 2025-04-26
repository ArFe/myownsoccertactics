import React, { useState } from 'react';
import SoccerField from './SoccerField';
import { default442Positions } from '../utils/formations';
import { PlayerPosition } from './SoccerField';

const SoccerFieldWithPlayers: React.FC = () => {
  const [homeTeam, setHomeTeam] = useState<PlayerPosition[]>(default442Positions.homeTeam);
  const [awayTeam, setAwayTeam] = useState<PlayerPosition[]>(default442Positions.awayTeam);

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

  return (
    <SoccerField
      homeTeam={homeTeam}
      awayTeam={awayTeam}
      onPlayerMove={handlePlayerMove}
    />
  );
};

export default SoccerFieldWithPlayers; 
