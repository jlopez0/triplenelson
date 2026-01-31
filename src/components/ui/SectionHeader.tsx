interface SectionHeaderProps {
  title: string;
  subtitle?: string;
}

export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <div className="space-y-6">
      <h2 className="font-display text-display uppercase">
        {title}
      </h2>
      {subtitle && (
        <p className="text-lg text-gray">
          {subtitle}
        </p>
      )}
    </div>
  );
}
