"use client";

import { useFormState } from "react-dom";
import { sendMessage } from "@/lib/actions";
import { CornerDownRight } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { TechnoButton } from "@/components/ui/TechnoButton";

export default function ContactPage() {
  const [state, formAction] = useFormState(sendMessage, { success: false, message: "" });

  return (
    <div className="w-full min-h-screen pt-32 pb-20 px-4 md:px-12 flex flex-col items-center">
      <div className="w-full max-w-4xl">
        <div className="mb-20">
          <SectionHeader title="Contact" />
        </div>

        <div className="bg-surface border border-white/10 p-1">
          {state?.success ? (
            <div className="text-center py-20 bg-surface-highlight animate-reveal">
               <h3 className="font-display text-5xl uppercase text-white mb-4">TRANSMISSION RECEIVED</h3>
               <p className="font-mono text-white/60 mb-8 max-w-lg mx-auto">
                 Over and out.
               </p>
               <TechnoButton href="/" variant="outline">RETURN</TechnoButton>
            </div>
          ) : (
            <form action={formAction} className="p-8 md:p-16 space-y-12">
              <div className="space-y-12">
                <div className="group relative">
                    <label htmlFor="name" className="font-mono text-xs text-brand-acid uppercase block mb-4 group-focus-within:text-white transition-colors">// IDENTIFIER (NAME)</label>
                    <input name="name" id="name" required className="block w-full bg-transparent border-b-2 border-white/20 py-4 font-display text-3xl text-white focus:border-brand-acid outline-none transition-all placeholder:text-white/10" placeholder="TYPE HERE..." />
                    {state?.errors?.name && <p className="text-brand-alert text-sm mt-2 font-mono">{state.errors.name}</p>}
                </div>
                
                <div className="group relative">
                    <label htmlFor="email" className="font-mono text-xs text-brand-acid uppercase block mb-4 group-focus-within:text-white transition-colors">// FREQUENCY (EMAIL)</label>
                    <input name="email" id="email" type="email" required className="block w-full bg-transparent border-b-2 border-white/20 py-4 font-display text-3xl text-white focus:border-brand-acid outline-none transition-all placeholder:text-white/10" placeholder="TYPE HERE..." />
                </div>

                <div className="group relative">
                    <label htmlFor="message" className="font-mono text-xs text-brand-acid uppercase block mb-4 group-focus-within:text-white transition-colors">// MESSAGE DATA</label>
                    <textarea name="message" id="message" required rows={4} className="block w-full bg-white/5 border border-white/10 p-4 font-mono text-lg text-white focus:border-brand-acid outline-none transition-all resize-none" placeholder="Start typing..." />
                </div>
              </div>

              <div className="flex justify-end pt-8 border-t border-white/10">
                 <button type="submit" className="bg-white text-black font-display font-bold text-xl uppercase px-12 py-5 hover:bg-brand-acid transition-colors flex items-center gap-3">
                    SEND TRANSMISSION <CornerDownRight />
                 </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
