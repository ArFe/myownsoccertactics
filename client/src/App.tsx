import { useState } from 'react'
import SoccerField from './components/SoccerField'
import { default442Positions } from './utils/formations'
import './App.css'

function App() {
  const [homeTeam, setHomeTeam] = useState(default442Positions.homeTeam);
  const [awayTeam, setAwayTeam] = useState(default442Positions.awayTeam);
  const [ballPosition, setBallPosition] = useState(default442Positions.ball);

  const handlePlayerMove = (team: 'home' | 'away', index: number, position: { x: number; y: number }) => {
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

  const handleBallMove = (position: { x: number; y: number }) => {
    setBallPosition(position);
  };

  return (
    <div className="App">
      <SoccerField
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        ballPosition={ballPosition}
        onPlayerMove={handlePlayerMove}
        onBallMove={handleBallMove}
      />
    </div>
  )
}

export default App
