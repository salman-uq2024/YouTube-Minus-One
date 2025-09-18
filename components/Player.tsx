'use client';

import { useEffect, useRef } from 'react';

interface PlayerProps {
  videoId: string;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export function Player({ videoId }: PlayerProps) {
  const playerRef = useRef<HTMLDivElement>(null);
  const ytPlayerRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;

    function createPlayer() {
      if (!playerRef.current || !window.YT || ytPlayerRef.current) {
        return;
      }
      ytPlayerRef.current = new window.YT.Player(playerRef.current, {
        videoId,
        playerVars: {
          autoplay: 0,
          controls: 1,
          rel: 0,
          enablejsapi: 1
        }
      });
    }

    if (window.YT && window.YT.Player) {
      createPlayer();
    } else {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(script);
      window.onYouTubeIframeAPIReady = () => {
        if (isMounted) {
          createPlayer();
        }
      };
    }

    const handleVisibilityChange = () => {
      if (document.hidden && ytPlayerRef.current?.pauseVideo) {
        ytPlayerRef.current.pauseVideo();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (ytPlayerRef.current?.destroy) {
        ytPlayerRef.current.destroy();
        ytPlayerRef.current = null;
      }
    };
  }, [videoId]);

  useEffect(() => {
    if (ytPlayerRef.current?.cueVideoById) {
      ytPlayerRef.current.cueVideoById(videoId);
    }
  }, [videoId]);

  return <div ref={playerRef} className="aspect-video w-full" />;
}
