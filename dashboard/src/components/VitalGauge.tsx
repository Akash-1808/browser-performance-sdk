import { getRating, ratingColors, thresholds } from '../lib/thresholds';

interface VitalGaugeProps {
    metric: keyof typeof thresholds;
    value: number | null;
    label: string;
}

export function VitalGauge({ metric, value, label }: VitalGaugeProps) {
    // 1. Handle empty state (before data loads)
    if (value === null) {
        return (
            <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                <h3 style={{ color: 'var(--text-secondary)' }}>{label}</h3>
                <p style={{ marginTop: '1rem' }}>No data</p>
            </div>
        );
    }

    // 2. Get the rating and color for this specific value
    const rating = getRating(metric, value);
    const color = ratingColors[rating];

    // 3. Formatting rules: CLS has no units, everything else is milliseconds (ms)
    const unit = metric === 'cls' ? '' : 'ms';
    const displayValue = metric === 'cls' ? value.toFixed(2) : Math.round(value);

    // 4. SVG Circle Math for the animated gauge
    const radius = 40;
    const circumference = 2 * Math.PI * radius;

    // Calculate how full the gauge should be (0% to 100%)
    const maxLimit = thresholds[metric].poor * 1.2;
    const percent = Math.min((value / maxLimit) * 100, 100);
    const dashoffset = circumference - (percent / 100) * circumference;

    return (
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>{label}</h3>

            <div style={{ position: 'relative', width: '100px', height: '100px' }}>
                {/* Background Track Circle */}
                <svg width="100" height="100" style={{ transform: 'rotate(-90deg)' }}>
                    <circle
                        cx="50" cy="50" r={radius}
                        stroke="var(--border-subtle)"
                        strokeWidth="8"
                        fill="transparent"
                    />
                    {/* Foreground Animated Value Circle */}
                    <circle
                        cx="50" cy="50" r={radius}
                        stroke={color}
                        strokeWidth="8"
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={dashoffset}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 1s ease-out, stroke 0.5s ease' }}
                    />
                </svg>

                {/* Number in the center of the circle */}
                <div style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                        {displayValue}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {unit}
                    </span>
                </div>
            </div>

            {/* Dynamic colored badge at the bottom */}
            <div style={{
                marginTop: '1.25rem',
                padding: '0.25rem 0.75rem',
                borderRadius: '999px',
                backgroundColor: `${color}20`, // 20% opacity of the main color
                color: color,
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
            }}>
                {rating.replace('-', ' ')}
            </div>
        </div>
    );
}