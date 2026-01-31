"use client";

import { useState } from "react";
import Image from "next/image";
import { X, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeader } from "@/components/ui/SectionHeader";

const PHOTOS = [
  { src: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80", alt: "Party Crowd 1" },
  { src: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&q=80", alt: "Drinks" },
  { src: "https://images.unsplash.com/photo-1533174072545-e8d4aa97edf9?w=800&q=80", alt: "Confetti" },
  { src: "https://images.unsplash.com/photo-1514525253440-b393332569ca?w=800&q=80", alt: "DJ" },
  { src: "https://images.unsplash.com/photo-1545128485-c400e7702796?w=800&q=80", alt: "Neon Lights" },
  { src: "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=800&q=80", alt: "Music Festival" },
];

export default function GalleryPage() {
  const [selectedImage, setSelectedImage] = useState<typeof PHOTOS[0] | null>(null);

  return (
    <div className="w-full min-h-screen pt-32 px-6 lg:px-12 flex flex-col">
      <div className="max-w-[1920px] mx-auto w-full">
         <SectionHeader title="Gallery" />
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1">
          {PHOTOS.map((photo, i) => (
            <div 
              key={i} 
              className="relative aspect-square group overflow-hidden cursor-none bg-zinc-900 border border-black"
              onClick={() => setSelectedImage(photo)}
            >
              <Image
                src={photo.src}
                alt={photo.alt}
                width={800}
                height={600}
                className="w-full h-full object-cover transition-all duration-700 grayscale group-hover:grayscale-0 group-hover:scale-110 opacity-70 group-hover:opacity-100"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-brand-acid/20 opacity-0 group-hover:opacity-100 transition-opacity mix-blend-multiply pointer-events-none" />
              <div className="absolute bottom-4 left-4 font-mono text-xs text-brand-acid opacity-0 group-hover:opacity-100 transition-opacity">
                IMG_00{i + 1}.RAW
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox - Brutalist Style */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-0 md:p-12 animate-reveal"
          onClick={() => setSelectedImage(null)}
        >
          <div className="absolute top-0 right-0 p-8 z-50">
             <button 
                className="text-white hover:text-brand-acid font-display text-2xl uppercase tracking-widest"
                onClick={() => setSelectedImage(null)}
             >
                [CLOSE X]
             </button>
          </div>
          
          <div className="relative w-full h-full flex items-center justify-center border border-white/10 bg-black">
             {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={selectedImage.src} 
              alt={selectedImage.alt}
              className="max-w-full max-h-full object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
