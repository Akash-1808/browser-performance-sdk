export const thresholds = {
    lcp: { good: 2500, poor: 4000 },
    fid: { good: 100, poor: 300 },
    cls: { good: 0.1, poor: 0.25 },
    ttfb: { good: 800, poor: 1800 },
} as const;

export type Rating = 'good' | 'needs-improvement' | 'poor'

export function getRating(metric: keyof typeof thresholds, value: number): Rating {

    const t = thresholds[metric]
    if (value <= t.good) return 'good'
    if (value <= t.poor) return 'needs-improvement'
    return 'poor'
}

export const ratingColors = {
    'good': '#0cce6b',
    'needs-improvement': '#ffa400',
    'poor': '#ff4e42'
} as const