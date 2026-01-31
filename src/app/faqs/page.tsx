import faqs from '@/../content/faqs.json';
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Plus } from 'lucide-react';

export default function FaqsPage() {
  return (
    <div className="w-full min-h-screen pt-32 px-6 lg:px-12 flex flex-col items-center">
      <div className="w-full max-w-[1920px]">
        <SectionHeader title="FAQs" />
        
        <div className="mt-12 border-t border-white/10">
          {faqs.map((faq, index) => (
            <details key={index} className="group border-b border-white/10 open:bg-white/5 transition-colors">
              <summary className="flex items-center justify-between p-6 md:p-8 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
                <div className="flex items-center gap-6">
                    <span className="font-mono text-brand-acid text-sm tracking-widest hidden md:block">
                        0{index + 1}
                    </span>
                    <h3 className="font-display text-2xl md:text-3xl uppercase text-white group-hover:text-brand-acid transition-colors">
                    {faq.question}
                    </h3>
                </div>
                <Plus className="w-6 h-6 text-white group-open:rotate-45 transition-transform duration-300" />
              </summary>
              <div className="px-6 md:px-8 pb-8 pt-0 pl-12 md:pl-20 animate-reveal">
                <p className="font-mono text-lg text-white/70 max-w-2xl leading-relaxed">
                   <span className="text-brand-acid mr-2">{">>"}</span>
                   {faq.answer}
                </p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
