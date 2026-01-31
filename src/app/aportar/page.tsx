"use client";

import { useState } from "react";
import eventData from "@/../content/event.json";
import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/SectionHeader";

const AMOUNTS = eventData.bizum.suggestedAmounts;

export default function AportarPage() {
  const [selected, setSelected] = useState(AMOUNTS[1]);
  const [step, setStep] = useState<1 | 2>(1);

  return (
    <div className="w-full min-h-screen">
      
      {/* HERO */}
      <section className="section-spacing pt-40">
        <div className="container-grid text-center space-y-16">
          <SectionHeader 
            title="Tickets" 
            subtitle="Bizum payment only" 
          />

          {step === 1 && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
                {AMOUNTS.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setSelected(amount)}
                    className={`
                      h-32 border border-white/10 flex flex-col items-center justify-center
                      transition-all duration-200
                      ${selected === amount ? 'bg-white text-black' : 'bg-transparent text-white hover:border-white/30'}
                    `}
                  >
                    <span className="font-display text-4xl">{amount}</span>
                    <span className="text-sm text-gray mt-1">EUR</span>
                  </button>
                ))}
              </div>

              <div className="space-y-6 max-w-md mx-auto pt-8">
                <div className="space-y-2">
                  <p className="text-small text-gray">Bizum Number</p>
                  <p className="font-display text-3xl">{eventData.bizum.phone}</p>
                </div>
                <Button onClick={() => setStep(2)}>
                  I'VE SENT {selected}€
                </Button>
              </div>
            </>
          )}

          {step === 2 && (
            <div className="max-w-md mx-auto space-y-8">
              <p className="text-xl text-gray">
                Thanks! Check your email for confirmation.
              </p>
              <Button href="/" variant="secondary">
                BACK TO HOME
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
