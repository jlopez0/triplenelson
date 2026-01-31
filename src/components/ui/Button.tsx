import Link from "next/link";
import { cn } from "@/lib/utils";

interface ButtonProps {
  href?: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}

export function Button({ href, children, variant = "primary", className, onClick, type = "button", disabled }: ButtonProps) {
  const baseStyles = "inline-block px-8 py-4 text-sm font-bold tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  
  const styles = {
    primary: "bg-white text-black hover:bg-acid hover:text-black",
    secondary: "bg-transparent border-2 border-white text-white hover:bg-white hover:text-black",
  };

  if (href) {
    return (
      <Link href={href} className={cn(baseStyles, styles[variant], className)}>
        {children}
      </Link>
    );
  }

  return (
    <button 
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(baseStyles, styles[variant], className)}
    >
      {children}
    </button>
  );
}
