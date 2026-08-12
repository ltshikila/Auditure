import googlePlayIcon from '@/assets/google-play-icon.svg';
import { WaitlistForm } from './waitlist-form';

const CLOSING_NOTES = [
  { title: 'Custom AI Voices', body: 'Every podcaster sounds unique.' },
  { title: 'Any Book You Own', body: 'Upload it and it becomes a podcast.' },
  { title: 'Share & Discover', body: 'A community of Virtual Podcaster creators.' },
];

export function CTA() {
  return (
    <section className="py-20 md:py-32 bg-[#120E0C]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <h2 className="font-['EB_Garamond',serif] text-white display-tight text-4xl md:text-6xl lg:text-7xl measure-wide">
          Ready to Create Your First Virtual Podcaster?
        </h2>
        <p className="standfirst text-white/70 text-xl md:text-2xl mt-6 measure">
          Turn your bookshelf into a podcast library.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mt-12">
          <a
            href="https://play.google.com/store/apps/details?id=com.auditure.app"
            target="_blank"
            rel="noopener noreferrer"
            className="gilt bg-[#C2A14D] hover:bg-[#D9B863] text-[#1A1512] px-10 py-5 rounded-[2px] btn-label text-lg flex items-center justify-center gap-3 transition-colors"
          >
            <img src={googlePlayIcon} alt="" width="28" height="28" />
            Download on Android
          </a>
          <button className="text-white border border-white/40 px-10 py-5 rounded-[2px] btn-label text-lg flex items-center justify-center gap-3 cursor-default">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
              <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.09997 22C7.78997 22.05 6.79997 20.68 5.95997 19.47C4.24997 17 2.93997 12.45 4.69997 9.39C5.56997 7.87 7.12997 6.91 8.81997 6.88C10.1 6.86 11.32 7.75 12.11 7.75C12.89 7.75 14.37 6.68 15.92 6.84C16.57 6.87 18.39 7.1 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.09 16.67C20.06 16.74 19.67 18.11 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z"/>
            </svg>
            iOS Coming Soon
          </button>
        </div>

        <div className="flex flex-col items-start gap-3 mt-12">
          <p className="font-['EB_Garamond',serif] text-white/60 text-sm">
            On iOS? Get notified the moment we launch.
          </p>
          <WaitlistForm variant="dark" platform="ios" />
        </div>

        <div className="grid gap-10 md:gap-12 md:grid-cols-3 mt-20 md:mt-28">
          {CLOSING_NOTES.map((note, index) => (
            <div key={note.title} className="border-t border-white/20 pt-4">
              <span className="label-caps text-white/40 block mb-5">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="font-['EB_Garamond',serif] text-white text-xl mb-2">
                {note.title}
              </h3>
              <p className="font-['EB_Garamond',serif] text-white/60 text-sm leading-relaxed">
                {note.body}
              </p>
            </div>
          ))}
        </div>

        <p className="font-['EB_Garamond',serif] text-white/40 text-sm mt-20 pt-8 border-t border-white/10">
          Live on Android. iOS coming soon.
        </p>
      </div>
    </section>
  );
}
