import { useState, useRef, useEffect } from 'react';
import { PlayerPosition } from '../components/SoccerField';
import { Play } from '../components/PlaysList';

interface UsePlaybackProps {
  play: Play | null;
  onPositionUpdate: (homeTeam: PlayerPosition[], awayTeam: PlayerPosition[], ballPosition: PlayerPosition) => void;
}

export const usePlayback = ({ play, onPositionUpdate }: UsePlaybackProps) => {
  const defaultSpeed = 0.040;
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x speed by default
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentIndexRef = useRef<number>(0);
  const [totalNumberOfPlays, setTotalNumberOfPlays] = useState(0);
  const startPlayback = () => {
    if (!play?.movements) return;

    setIsPlaying(true);
    setTotalNumberOfPlays(play.movements.timestamps.length);
    currentIndexRef.current = 0;
    scheduleNextFrame();
  };

  const pausePlayback = () => {
    console.log("pausePlayback");
    console.log("currentIndex", currentIndex);
    setIsPlaying(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  const stopPlayback = () => {
    setIsPlaying(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  const seekTo = (currentIndex: number) => {
    if (!play?.movements) return;

    const elapsedTime = defaultSpeed*currentIndex;
    setCurrentTime(elapsedTime);
    currentIndexRef.current = currentIndex;
    setCurrentIndex(currentIndex);
    onPositionUpdate(
      play.movements.homeTeam[currentIndex],
      play.movements.awayTeam[currentIndex],
      play.movements.ballPosition[currentIndex]
    );
  };

  const setSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    console.log("speed", speed);
    // If currently playing, restart playback with new speed
    if (isPlaying) {
      pausePlayback();
      startPlayback();
    }
  };

  const scheduleNextFrame = () => {
    if (!play?.movements) return;

    const elapsedTime = defaultSpeed*currentIndexRef.current;
    setCurrentTime(elapsedTime);

    if (elapsedTime >= duration) {
      stopPlayback();
      return;
    }

    const nextIndex = currentIndexRef.current + 1;
    
    currentIndexRef.current = nextIndex;
    onPositionUpdate(
      play.movements.homeTeam[nextIndex],
      play.movements.awayTeam[nextIndex],
      play.movements.ballPosition[nextIndex]
    );

    // Schedule next frame with speed adjustment
    const timePerFrame = defaultSpeed*1000/playbackSpeed;
    timeoutRef.current = setTimeout(scheduleNextFrame, timePerFrame);
    setCurrentIndex(nextIndex);
    console.log("currentIndex", nextIndex);
  };

  useEffect(() => {
    if (play?.movements) {
      const startTime = 0;
      const endTime = (play.movements.timestamps.length - 1) * defaultSpeed;
      console.log("duration", endTime - startTime);
      console.log(startTime, endTime);
      setDuration((endTime - startTime)); // Convert to seconds for display
      currentIndexRef.current = 0;
    }
  }, [play]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
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
  };
}; 
