import express, { Request, Response } from 'express';
import { db } from '../db/db';
import { authenticate, authorizeDomain } from '../middleware/auth';

const route = express.Router();

// Map valid dashboard ranges to Postgres intervals and bucket sizes
const RANGES = {
    '1h': { interval: '1 hour', bucket: '5 minutes' },
    '24h': { interval: '24 hours', bucket: '1 hour' },
    '7d': { interval: '7 days', bucket: '6 hours' },
    '30d': { interval: '30 days', bucket: '1 day' }
} as const;

type RangeKey = keyof typeof RANGES;

route.get('/metrics', authenticate, authorizeDomain, async (req: Request, res: Response) => {
    const domain = req.query.domain as string;
    const range = (req.query.range as string) || '24h';

    // 1. Validation
    if (!domain) {
        res.status(400).json({ error: 'Missing domain parameter' });
        return;
    }

    if (!(range in RANGES)) {
        res.status(400).json({ error: 'Invalid range. Use 1h, 24h, 7d, or 30d' });
        return;
    }

    const { interval, bucket } = RANGES[range as RangeKey];

    try {
        // 2. Query 1: Overall p75 scores for the dashboard gauges
        // Google Lighthouse uses the 75th percentile (p75) to grade Web Vitals
        const overallQuery = await db.query(`
            SELECT 
                metric,
                percentile_cont(0.75) WITHIN GROUP (ORDER BY value) as p75
            FROM events
            WHERE domain = $1
              AND time > NOW() - $2::interval
              AND value IS NOT NULL
            GROUP BY metric
        `, [domain, interval]);

        // 3. Query 2: Time-series data using TimescaleDB's time_bucket()
        // This is what makes TimescaleDB so fast — it groups time efficiently
        const seriesQuery = await db.query(`
            SELECT 
                time_bucket($3::interval, time) AS time,
                metric,
                percentile_cont(0.75) WITHIN GROUP (ORDER BY value) as p75
            FROM events
            WHERE domain = $1
              AND time > NOW() - $2::interval
              AND value IS NOT NULL
            GROUP BY time, metric
            ORDER BY time ASC
        `, [domain, interval, bucket]);

        res.status(200).json({
            overall: overallQuery.rows,
            series: seriesQuery.rows
        });
    } catch (err) {
        console.error('Metrics DB Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default route;