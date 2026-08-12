import { RANDOM_EPISODE_EVENT } from "./episode-events";
import { SectionOpener } from "./section-opener";
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

  // "Open at Random" from the hero: scroll here, then play one at random.
  useEffect(() => {
    const openAtRandom = () => {
      const idx = Math.floor(Math.random() * EPISODES.length);
      document.querySelector('#listen')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Let the scroll settle before the audio starts, so the card you hear is
      // the card you are looking at.
      window.setTimeout(() => handlePlay(idx), 650);
    };

    window.addEventListener(RANDOM_EPISODE_EVENT, openAtRandom);
    return () => window.removeEventListener(RANDOM_EPISODE_EVENT, openAtRandom);
  });

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
    <section id="listen" className="py-20 md:py-28 bg-[#221A16]">
      <style>{`
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(194, 161, 77, 0.45), 0 20px 30px -10px rgba(194, 161, 77, 0.25); }
          50% { box-shadow: 0 0 0 12px rgba(194, 161, 77, 0), 0 25px 35px -8px rgba(194, 161, 77, 0.35); }
        }
        .animate-pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }
      `}</style>
      <div className="mx-auto max-w-[1500px] px-4 sm:px-6 lg:px-8">
        <SectionOpener
          numeral="V"
          runningHead="Listen"
          title="Listen to an Episode"
          standfirst="Real episodes, from real books. Press play for a 45 second sample."
        />

        <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {EPISODES.map((ep, idx) => {
            const isPlaying = playingIdx === idx;
            const p = progress[idx];
            const pct = p && p.duration ? (p.current / p.duration) * 100 : 0;
            const time = p ? formatTime(p.current) : "0:00";
            const dur = p ? formatTime(p.duration) : "0:45";

            return (
              <div
                key={ep.audio}
                className={`group rounded-[2px] overflow-hidden bg-[#1A1512] border transition-all duration-300 hover:-translate-y-1 ${
                  isPlaying
                    ? "border-[#C2A14D] animate-pulse-glow"
                    : "border-[#EDE4D6]/12"
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
                  <h3 className="font-['EB_Garamond',serif] text-[#EDE4D6] text-lg leading-snug mb-2 line-clamp-2 min-h-[3.25rem]">
                    {ep.episodeTitle}
                  </h3>
                  <p className="font-['EB_Garamond',serif] text-[#A2907C] text-sm mb-5 line-clamp-1">
                    {ep.bookTitle} <span className="text-[#A2907C]/60">· {ep.author}</span>
                  </p>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handlePlay(idx)}
                      className={`shrink-0 w-[3.25rem] h-[3.25rem] rounded-full flex items-center justify-center transition-all duration-200 ${
                        isPlaying
                          ? "bg-[#C2A14D] text-[#1A1512] scale-105"
                          : "bg-[#120E0C] text-white hover:bg-[#C2A14D] hover:text-[#1A1512] group-hover:scale-105"
                      }`}
                      aria-label={isPlaying ? "Pause" : "Play"}
                    >
                      {isPlaying ? <PauseIcon /> : <PlayIcon />}
                    </button>

                    <div className="flex-1">
                      <div className="h-1.5 bg-[#EDE4D6]/20 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#C2A14D] transition-[width] duration-100"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-1.5 font-['EB_Garamond',serif] text-xs text-[#A2907C]">
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

        <p className="font-['EB_Garamond',serif] text-[#A2907C] text-sm text-center mt-10 max-w-2xl mx-auto">
          Episode titles, voices, and content are all generated by Auditure users on the app. Each book host is a custom Virtual Podcaster designed by a real listener.
        </p>
      </div>
    </section>
  );
}
