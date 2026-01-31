import eventData from "@/../content/event.json";
import { Countdown } from "@/components/features/Countdown";
import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/SectionHeader";

export default function Home() {
  return (
    <div className="w-full">
      
      {/* HERO */}
      <section className="min-h-screen flex flex-col items-center justify-center container-custom pt-32 pb-16">
        <div className="text-center w-full space-y-12 animate-fade-in">
          
          <div className="space-y-4">
            <h1 className="font-display text-hero uppercase leading-none">
              TRIPLE<br/>NELSON
            </h1>
            <p className="text-display font-display uppercase tracking-tight text-gray">
              BIRTHDAY RAVE
            </p>
          </div>

          <p className="text-body max-w-2xl mx-auto text-gray">
            Secret warehouse. One night only.<br/>
            Pure underground techno until sunrise.
          </p>

          <div className="pt-8">
            <Countdown targetDate={eventData.date} />
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-12">
            <Button href="/aportar">GET TICKETS</Button>
            <Button href="/faqs" variant="secondary">MORE INFO</Button>
          </div>

          <div className="pt-16 text-small tracking-widest text-gray space-x-6">
            <span>{new Date(eventData.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}</span>
            <span>·</span>
            <span>{eventData.location.toUpperCase()}</span>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section className="section-padding border-t border-white/10">
        <div className="container-custom">
          <SectionHeader 
            title="What to expect" 
            subtitle="This isn't a typical party. Come prepared for a proper warehouse experience." 
          />
          <div className="grid md:grid-cols-2 gap-12 text-body text-gray">
            <div>
              <h3 className="text-white mb-4 font-bold">The Vibe</h3>
              <p>{eventData.description}</p>
            </div>
            <div>
              <h3 className="text-white mb-4 font-bold">Dress Code</h3>
              <p>{eventData.dressCode}. Comfortable shoes recommended—you'll be dancing all night.</p>
            </div>
          </div>
        </div>
      </section>

      {/* LOCATION */}
      <section className="section-padding border-t border-white/10">
        <div className="container-custom">
          <SectionHeader 
            title="Location" 
            subtitle="Address revealed 24h before the event to ticket holders only." 
          />
          <div className="aspect-[2/1] bg-white/5 flex items-center justify-center">
            <p className="text-gray text-small tracking-[0.3em]">[ SECRET WAREHOUSE ]</p>
          </div>
        </div>
      </section>

      {/* SCHEDULE */}
      <section className="section-padding border-t border-white/10">
        <div className="container-custom">
          <SectionHeader title="Timeline" />
          <div className="space-y-8 max-w-3xl">
            <div className="flex justify-between items-baseline border-b border-white/10 pb-4">
              <span className="font-display text-title">23:00</span>
              <span className="text-gray">Doors Open</span>
            </div>
            <div className="flex justify-between items-baseline border-b border-white/10 pb-4">
              <span className="font-display text-title">00:00 — 03:00</span>
              <span className="text-gray">Peak Time</span>
            </div>
            <div className="flex justify-between items-baseline border-b border-white/10 pb-4">
              <span className="font-display text-title">03:00 — 06:00</span>
              <span className="text-gray">Closing Set</span>
            </div>
            <div className="flex justify-between items-baseline border-b border-white/10 pb-4">
              <span className="font-display text-title">06:00+</span>
              <span className="text-gray">Until The End</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding border-t border-white/10">
        <div className="container-custom text-center space-y-8">
          <h2 className="font-display text-display uppercase">
            Ready?
          </h2>
          <Button href="/aportar">SECURE YOUR SPOT</Button>
        </div>
      </section>
    </div>
  );
}
