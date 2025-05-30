import { useState, useRef, useEffect } from 'react';
import { PlayerPosition } from '../components/SoccerField';
import { Play } from '../components/PlaysList';
import GIF from 'gif.js';

interface UsePlaybackProps {
  play: Play | null;
  onPositionUpdate: (homeTeam: PlayerPosition[], awayTeam: PlayerPosition[], ballPosition: PlayerPosition) => void;
}

export const usePlayback = ({ play, onPositionUpdate }: UsePlaybackProps) => {
  const fieldRef = useRef<HTMLDivElement>(null);
  const defaultSpeed = 0.040;
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x speed by default
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentIndexRef = useRef<number>(0);
  const [totalNumberOfPlays, setTotalNumberOfPlays] = useState(0);
  const gif = useRef<GIF>();

  const startPlayback = () => {
    if (!play?.movements) return;

    gif.current = new GIF({
      workers: 2,
      workerScript: '/gif.worker.js',
      quality: 10,
      width: 1304,
      height: 851
    });
    setIsPlaying(true);
    setTotalNumberOfPlays(play.movements.ballPosition.length);
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
    if (gif.current && !gif.current.running) {
      console.log("Saving gif");
      gif.current.on('finished', function(blob) {
        window.open(URL.createObjectURL(blob));
      });
  
      gif.current.render();
    } else {
      console.log("Gif is already running");
      gif.current?.abort();
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
    const field = document.getElementById('soccer-field') as HTMLCanvasElement;
    if (field && gif.current) {
      console.log("Adding frame");
      gif.current.addFrame(field, {
        delay: defaultSpeed*1000/playbackSpeed,
        copy: true,
        dispose: 2
      });
    };
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
  };

  useEffect(() => {
    if (play?.movements) {
      const startTime = 0;
      const endTime = (play.movements.ballPosition.length - 1) * defaultSpeed;
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
