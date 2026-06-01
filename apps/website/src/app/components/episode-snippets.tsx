import { useEffect, useRef, useState } from "react";
import agotCover from "@/assets/mock covers/agot.png";
import atomicCover from "@/assets/mock covers/atomic_habits.png";
import sapiensCover from "@/assets/mock covers/sapiens.png";
import lawsCover from "@/assets/mock covers/laws.png";
import thinkingCover from "@/assets/mock covers/thinking,fast and slow.png";

type Episode = {
  audio: string;
  cover: string;
  episodeTitle: string;
  bookTitle: string;
  author: string;
  accent: string;
};

const EPISODES: Episode[] = [
  {
    audio: "/audio/laws.mp3",
    cover: lawsCover,
    episodeTitle: "Are We All Narcissists?",
    bookTitle: "The Laws of Human Nature",
    author: "Robert Greene",
    accent: "#8B1A1F",
  },
  {
    audio: "/audio/atomic_habits.mp3",
    cover: atomicCover,
    episodeTitle: "The Math Behind 1%",
    bookTitle: "Atomic Habits",
    author: "James Clear",
    accent: "#1F4F7A",
  },
  {
    audio: "/audio/agot.mp3",
    cover: agotCover,
    episodeTitle: "Winter is Coming",
    bookTitle: "A Game of Thrones",
    author: "George R.R. Martin",
    accent: "#2F2F2F",
  },
  {
    audio: "/audio/sapiens.mp3",
    cover: sapiensCover,
    episodeTitle: "History's Biggest Fraud",
    bookTitle: "Sapiens",
    author: "Yuval Noah Harari",
    accent: "#C25700",
  },
  {
    audio: "/audio/thinking.mp3",
    cover: thinkingCover,
    episodeTitle: "Your Brain is Lying to You",
    bookTitle: "Thinking, Fast and Slow",
    author: "Daniel Kahneman",
    accent: "#1A4D2E",
  },
];

function formatTime(seconds: number) {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function PlayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
    </svg>
  );
}

export function EpisodeSnippets() {
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const [progress, setProgress] = useState<Record<number, { current: number; duration: number }>>({});
  const audioRefs = useRef<(HTMLAudioElement | null)[]>([]);

  useEffect(() => {
    return () => {
      audioRefs.current.forEach((a) => {
        if (a) {
          a.pause();
          a.currentTime = 0;
        }
      });
    };
  }, []);

  const handlePlay = (idx: number) => {
    const audio = audioRefs.current[idx];
    if (!audio) return;

    if (playingIdx === idx) {
      audio.pause();
      setPlayingIdx(null);
      return;
    }

    if (playingIdx !== null) {
      const current = audioRefs.current[playingIdx];
      if (current) {
        current.pause();
      }
    }

    audio.play().catch(() => {
      setPlayingIdx(null);
    });
    setPlayingIdx(idx);
  };

  const handleTimeUpdate = (idx: number) => {
    const audio = audioRefs.current[idx];
    if (!audio) return;
    setProgress((prev) => ({
      ...prev,
      [idx]: { current: audio.currentTime, duration: audio.duration },
    }));
  };

  const handleEnded = (idx: number) => {
    setPlayingIdx((cur) => (cur === idx ? null : cur));
    const audio = audioRefs.current[idx];
    if (audio) audio.currentTime = 0;
  };

  return (
    <section id="listen" className="py-20 md:py-28 bg-[#F5F0E8]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="font-['DM_Serif_Display',serif] text-[#2f2f2f] text-4xl md:text-5xl mb-4">
            Listen to an Episode
          </h2>
          <p className="font-['Plus_Jakarta_Sans',sans-serif] text-[#5a5a5a] text-lg md:text-xl max-w-2xl mx-auto">
            Real episodes, generated from real books by real users. Hit play on any card to hear a 45 second sample.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {EPISODES.map((ep, idx) => {
            const isPlaying = playingIdx === idx;
            const p = progress[idx];
            const pct = p && p.duration ? (p.current / p.duration) * 100 : 0;
            const time = p ? formatTime(p.current) : "0:00";
            const dur = p ? formatTime(p.duration) : "0:45";

            return (
              <div
                key={ep.audio}
                className={`rounded-[20px] overflow-hidden shadow-md transition-all bg-[#FBF8F2] border ${
                  isPlaying ? "border-[#920002] shadow-xl" : "border-[#d0d0d0]/40"
                }`}
              >
                <div
                  className="relative aspect-[3/4] flex items-end p-4"
                  style={{ backgroundColor: ep.accent }}
                >
                  <img
                    src={ep.cover}
                    alt={ep.bookTitle}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>

                <div className="p-5">
                  <h3 className="font-['DM_Serif_Display',serif] text-[#2f2f2f] text-xl mb-1 line-clamp-1">
                    {ep.episodeTitle}
                  </h3>
                  <p className="font-['Plus_Jakarta_Sans',sans-serif] text-[#5a5a5a] text-sm mb-1 line-clamp-1">
                    {ep.bookTitle}
                  </p>
                  <p className="font-['Plus_Jakarta_Sans',sans-serif] text-[#5a5a5a]/70 text-xs mb-4">
                    {ep.author}
                  </p>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handlePlay(idx)}
                      className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
                        isPlaying
                          ? "bg-[#920002] text-white"
                          : "bg-[#2f2f2f] text-white hover:bg-[#920002]"
                      }`}
                      aria-label={isPlaying ? "Pause" : "Play"}
                    >
                      {isPlaying ? <PauseIcon /> : <PlayIcon />}
                    </button>

                    <div className="flex-1">
                      <div className="h-1.5 bg-[#d0d0d0] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#920002] transition-[width] duration-100"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-1.5 font-['Plus_Jakarta_Sans',sans-serif] text-xs text-[#5a5a5a]">
                        <span>{time}</span>
                        <span>{dur}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <audio
                  ref={(el) => {
                    audioRefs.current[idx] = el;
                  }}
                  src={ep.audio}
                  preload="metadata"
                  onTimeUpdate={() => handleTimeUpdate(idx)}
                  onEnded={() => handleEnded(idx)}
                />
              </div>
            );
          })}
        </div>

        <p className="font-['Plus_Jakarta_Sans',sans-serif] text-[#5a5a5a] text-sm text-center mt-10 max-w-2xl mx-auto">
          Episode titles, voices, and content are all generated by Auditure users on the app. Each book host is a custom AI podcaster designed by a real listener.
        </p>
      </div>
    </section>
  );
}
