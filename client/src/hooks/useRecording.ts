import { useState, useRef, useEffect } from 'react';
import { PlayerPosition } from '../components/SoccerField';

export interface RecordedMovements {
  homeTeam: PlayerPosition[][];
  awayTeam: PlayerPosition[][];
  ballPosition: PlayerPosition[];
}

interface UseRecordingProps {
  homeTeam: PlayerPosition[];
  awayTeam: PlayerPosition[];
  ballPosition: PlayerPosition;
  onRecord: (movements: RecordedMovements) => void;
}

export const useRecording = ({ homeTeam, awayTeam, ballPosition, onRecord }: UseRecordingProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedMovements, setRecordedMovements] = useState<RecordedMovements>({
    homeTeam: [],
    awayTeam: [],
    ballPosition: [],
  });
  const [numberOfHomeTeamPlayers, setNumberOfHomeTeamPlayers] = useState(0);
  const [numberOfAwayTeamPlayers, setNumberOfAwayTeamPlayers] = useState(0);
  const lastRecordedTime = useRef<number>(0);
  const lastPositions = useRef<{
    homeTeam: PlayerPosition[];
    awayTeam: PlayerPosition[];
    ballPosition: PlayerPosition;
  }>({
    homeTeam: [],
    awayTeam: [],
    ballPosition: { x: 0, y: 0 }
  });

  const startRecording = () => {
    setIsRecording(true);
    console.log('Starting recording with initial positions:');
    console.log('Home Team:', homeTeam);
    console.log('Away Team:', awayTeam);
    console.log('Ball Position:', ballPosition);
    setNumberOfHomeTeamPlayers(homeTeam.length);
    setNumberOfAwayTeamPlayers(awayTeam.length);
    // Initialize with current positions
    const initialBallPosition = ballPosition || { x: 0, y: 0 };
    const initialMovements = {
      homeTeam: [homeTeam],
      awayTeam: [awayTeam],
      ballPosition: [initialBallPosition],
      timestamps: [Date.now()]
    };
    setRecordedMovements(initialMovements);
    lastPositions.current = {
      homeTeam: [...homeTeam],
      awayTeam: [...awayTeam],
      ballPosition: { ...initialBallPosition }
    };
    lastRecordedTime.current = Date.now();
  };

  // groups all positions from all player and the ball in a single array
  // first add all positions from each home team player
  // then add all positions from each away team player
  // then add all positions from the ball 
  const groupPositions = (movements: RecordedMovements) => {
    const groupedPositions: PlayerPosition[][] = [];

    // Group home team player positions
    movements.homeTeam.forEach((frame) => {
      frame.forEach((player, playerIndex) => {
        if (!groupedPositions[playerIndex]) {
          groupedPositions[playerIndex] = [];
        }
        groupedPositions[playerIndex].push(player);
      });
    });

    // Group away team player positions
    const homeTeamLength = movements.homeTeam[0]?.length || 0;
    movements.awayTeam.forEach((frame) => {
      frame.forEach((player, playerIndex) => {
        const awayPlayerIndex = homeTeamLength + playerIndex;
        if (!groupedPositions[awayPlayerIndex]) {
          groupedPositions[awayPlayerIndex] = [];
        }
        groupedPositions[awayPlayerIndex].push(player);
      });
    });

    // Group ball positions
    const ballIndex = (movements.homeTeam[0]?.length || 0) + (movements.awayTeam[0]?.length || 0);
    movements.ballPosition.forEach((position) => {
      if (!groupedPositions[ballIndex]) {
        groupedPositions[ballIndex] = [];
      }
      groupedPositions[ballIndex].push(position);
    });

    return groupedPositions;
  };
  // create new arrays for valid movements, 
  // aka movements that are different from the previous movement
  const createValidMovements = (positions: PlayerPosition[][]) => {
    const validMovements = positions.map((objects) => {
      const movements = objects.reduce((acc, object, index) => {
        if (index === 0) {
          acc.push(object);
        } else if (object.x !== acc[acc.length - 1].x || object.y !== acc[acc.length - 1].y) {
          acc.push(object);
        }
        return acc;
      }, [] as PlayerPosition[]);
      return movements;
    });
    return validMovements;
  }

  // Check the longest movement
  const checkLongestMovement = (movements: PlayerPosition[][]) => {
    const longestMovement = Math.max(...movements.map(movement => movement.length));
    return longestMovement;
  }

  // Map the player positions back to RecordedMovements
  // the first movements are the home team, then the away team, then the ball
  const mapPositionsToRecordedMovements = (positions: PlayerPosition[][], movements: RecordedMovements, longestMovement: number) => {
    const recordedMovements: RecordedMovements = {
      homeTeam: [],
      awayTeam: [],
      ballPosition: [],
    };
    console.log('numberOfHomeTeamPlayers', numberOfHomeTeamPlayers);
    console.log('numberOfAwayTeamPlayers', numberOfAwayTeamPlayers);
    // loop up to the longest movement
    for (let i = 0; i < longestMovement; i++) {
      positions.forEach((object, index) => {
        if (index < numberOfHomeTeamPlayers) {
          if (!recordedMovements.homeTeam[i]) {
            recordedMovements.homeTeam[i] = [];
          } 
          if (i < object.length) {
            recordedMovements.homeTeam[i].push(object[i]);
          } else {
            recordedMovements.homeTeam[i].push(object[object.length-1]);
          }
        } else if (index < numberOfHomeTeamPlayers + numberOfAwayTeamPlayers) {
          if (!recordedMovements.awayTeam[i]) {
            recordedMovements.awayTeam[i] = [];
          }
          if (i < object.length) {
            recordedMovements.awayTeam[i].push(object[i]);
          } else {
            recordedMovements.awayTeam[i].push(object[object.length-1]);
          }
        } else {
          if (!recordedMovements.ballPosition) {
            recordedMovements.ballPosition = [];
          }
          if (i < object.length) {
            recordedMovements.ballPosition.push(object[i]);
          } else {
            recordedMovements.ballPosition.push(object[object.length-1]);
          }
        }
      });
    }
    return recordedMovements;
  }

  // Create a function to condense movements
  // Group all movements in the beginning of the array
  // Consider a movement when the value is different from the previous value
  // The end of the play is the longest movement of all players or the ball
  // At the end of the array, repeat the last movement until the end of the play
  const squashMovements = (movements: RecordedMovements) => {
    const groupedPositions = groupPositions(movements);
    console.log('groupedPositions', groupedPositions);  
    const validMovements = createValidMovements(groupedPositions);
    console.log('validMovements', validMovements);
    const longestMovement = checkLongestMovement(validMovements);
    console.log('longestMovement', longestMovement);
    const recordedMovements = mapPositionsToRecordedMovements(validMovements, movements, longestMovement);
    console.log('recordedMovements', recordedMovements);
    return recordedMovements;
  }

  const stopRecording = () => {
    setIsRecording(false);
    const squashedMovements = squashMovements(recordedMovements);
    onRecord(squashedMovements);
  };

  useEffect(() => {
    if (isRecording) {
      const now = Date.now();
      // Get the latest positions
      const currentHomeTeam = [...homeTeam];
      const currentAwayTeam = [...awayTeam];
      const currentBallPosition = { ...ballPosition };

      // Check if positions have changed
      const positionsChanged =
        JSON.stringify(currentHomeTeam) !== JSON.stringify(lastPositions.current.homeTeam) ||
        JSON.stringify(currentAwayTeam) !== JSON.stringify(lastPositions.current.awayTeam) ||
        JSON.stringify(currentBallPosition) !== JSON.stringify(lastPositions.current.ballPosition);

      if (positionsChanged) {
        console.log('Positions changed, recording new state:');
        console.log('Current Home Team:', currentHomeTeam);
        console.log('Current Away Team:', currentAwayTeam);
        console.log('Current Ball Position:', currentBallPosition);

        // Update recorded movements with the latest positions
        setRecordedMovements(prev => {
          const newMovements = {
            homeTeam: [...prev.homeTeam, currentHomeTeam],
            awayTeam: [...prev.awayTeam, currentAwayTeam],
            ballPosition: [...prev.ballPosition, currentBallPosition],
          };
          console.log('Updated recorded movements:', newMovements);
          return newMovements;
        });

        // Update last recorded positions
        lastPositions.current = {
          homeTeam: currentHomeTeam,
          awayTeam: currentAwayTeam,
          ballPosition: currentBallPosition
        };
      }

    }

    return () => {
    };
  }, [isRecording, homeTeam, awayTeam, ballPosition]);

  return {
    isRecording,
    startRecording,
    stopRecording
  };
}; 
