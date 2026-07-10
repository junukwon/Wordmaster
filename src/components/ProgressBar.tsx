type ProgressBarProps = {
  value: number;
  max: number;
  label?: string;
};

export function ProgressBar({ value, max, label = '학습 진행률' }: ProgressBarProps) {
  const safeMax = Math.max(1, max);
  const percentage = Math.min(100, Math.max(0, Math.round((value / safeMax) * 100)));
  return (
    <div className="progress" aria-label={label} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <div className="progress__track">
        <span className="progress__fill" style={{ width: `${percentage}%` }} />
      </div>
      <span className="progress__label">{value} / {max} · {percentage}%</span>
    </div>
  );
}
