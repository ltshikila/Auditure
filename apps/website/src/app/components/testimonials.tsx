export function Testimonials() {
  const testimonials = [
    {
      name: "Sarah Mitchell",
      role: "Book Enthusiast",
      quote: "Auditure has completely transformed my reading habits. I finish twice as many books now while commuting!",
      rating: 5
    },
    {
      name: "James Chen",
      role: "Busy Professional",
      quote: "The offline feature is a game-changer. I download books for flights and never run out of entertainment.",
      rating: 5
    },
    {
      name: "Emily Rodriguez",
      role: "Student",
      quote: "Best audiobook app I've used. The recommendations are spot-on and the interface is beautiful.",
      rating: 5
    }
  ];

  return (
    <section className="py-20 md:py-28 bg-[#FBF8F2]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="font-['DM_Serif_Display',serif] text-[#2f2f2f] text-4xl md:text-5xl mb-4">
            Loved by Listeners
          </h2>
          <p className="font-['Plus_Jakarta_Sans',sans-serif] text-[#5a5a5a] text-lg md:text-xl">
            Join thousands of happy readers
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <div 
              key={index}
              className="bg-white p-8 rounded-[20px] shadow-lg hover:shadow-xl transition-shadow"
            >
              {/* Star Rating */}
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <svg key={i} width="20" height="20" viewBox="0 0 24 24" fill="#920002">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                  </svg>
                ))}
              </div>

              <p className="font-['Plus_Jakarta_Sans',sans-serif] text-[#2f2f2f] text-base mb-6 leading-relaxed">
                "{testimonial.quote}"
              </p>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#920002] rounded-full flex items-center justify-center">
                  <span className="font-['DM_Serif_Display',serif] text-white text-lg">
                    {testimonial.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="font-['Plus_Jakarta_Sans',sans-serif] text-[#2f2f2f]">
                    {testimonial.name}
                  </p>
                  <p className="font-['Plus_Jakarta_Sans',sans-serif] text-[#5a5a5a] text-sm">
                    {testimonial.role}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Stats Section */}
        <div className="mt-20 grid gap-8 md:grid-cols-4 text-center">
          {[
            { number: "500K+", label: "Active Users" },
            { number: "10K+", label: "Audiobooks" },
            { number: "4.8★", label: "App Rating" },
            { number: "50M+", label: "Hours Listened" }
          ].map((stat, index) => (
            <div key={index}>
              <p className="font-['DM_Serif_Display',serif] text-[#920002] text-4xl md:text-5xl mb-2">
                {stat.number}
              </p>
              <p className="font-['Plus_Jakarta_Sans',sans-serif] text-[#5a5a5a] text-lg">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
