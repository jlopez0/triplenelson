export function NoiseOverlay() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none opacity-[0.035] mix-blend-overlay">
       <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
         <filter id="noise">
           <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" />
         </filter>
         <rect width="100%" height="100%" filter="url(#noise)" />
       </svg>
    </div>
  );
}
