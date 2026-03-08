interface SectionLabelProps {
  label: string;
  className?: string;
}

export default function SectionLabel({ label, className = '' }: SectionLabelProps) {
  return (
    <div className={`mb-4 ${className}`}>
      <p className="section-label mb-2">{label}</p>
      <hr className="section-rule" />
    </div>
  );
}
