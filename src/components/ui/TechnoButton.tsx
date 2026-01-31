import { cn } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

interface TechnoButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  href?: string;
  variant?: "primary" | "secondary" | "outline";
}

export function TechnoButton({ href, className, children, variant = "primary", ...props }: TechnoButtonProps) {
  const baseStyles = "group relative inline-flex items-center justify-center px-8 py-4 font-display font-bold text-xl uppercase tracking-widest transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-brand-acid text-black hover:bg-white",
    secondary: "bg-white text-black hover:bg-brand-alert hover:text-white",
    outline: "border border-white/30 text-white hover:bg-white hover:text-black",
  };

  const Content = () => (
    <>
      <span className="relative z-10 flex items-center gap-2">
        {children}
        <ArrowUpRight className={cn(
            "w-5 h-5 transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1",
            variant === "primary" ? "text-black" : "text-current"
        )} />
      </span>
      {/* Glitch/Hover Effect Layer */}
      <span className="absolute inset-0 bg-current opacity-0 group-hover:opacity-10 transition-opacity" />
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cn(baseStyles, variants[variant], className)}>
        <Content />
      </Link>
    );
  }

  return (
    <button className={cn(baseStyles, variants[variant], className)} {...props}>
      <Content />
    </button>
  );
}
