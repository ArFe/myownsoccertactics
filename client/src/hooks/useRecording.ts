import { useState, useRef, useEffect } from 'react';
import { PlayerPosition } from '../components/SoccerField';

interface RecordedMovements {
  homeTeam: PlayerPosition[][];
  awayTeam: PlayerPosition[][];
  ballPosition: PlayerPosition[];
  timestamps: number[];
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
    timestamps: []
  });
  const recordingInterval = useRef<ReturnType<typeof setInterval>>();
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

  const stopRecording = () => {
    setIsRecording(false);
    if (recordingInterval.current) {
      clearInterval(recordingInterval.current);
    }
    onRecord(recordedMovements);
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
            timestamps: [...prev.timestamps, now]
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
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
      }
    };
  }, [isRecording, homeTeam, awayTeam, ballPosition]);

  return {
    isRecording,
    startRecording,
    stopRecording
  };
}; 
