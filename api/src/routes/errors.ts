import express from 'express'
import { db } from '../db/db';
import { authenticate, authorizeDomain } from '../middleware/auth';

const router = express.Router();

router.get('/errors', authenticate, authorizeDomain, async (req, res) => {
    const { domain } = req.query;

    if (!domain) {
        res.status(400).json({ error: 'Domain is required' });
        return;
    }

    try {
        const result = await db.query(`
            SELECT 
                meta->>'message' as message,
                MAX(meta->>'stack') as stack,
                MAX(meta->>'url') as url,
                COUNT(*) as occurrences,
                MAX(time) as last_seen
            FROM events
            WHERE domain = $1 
              AND metric = 'error' 
              AND meta IS NOT NULL 
              AND meta->>'message' IS NOT NULL
            GROUP BY meta->>'message'
            ORDER BY occurrences DESC
            LIMIT 50
        `, [domain]);

        res.json(result.rows);
    } catch (err) {
        console.error("Failed to fetch errors:", err);
        res.status(500).json({ error: 'Internal server error' });
    }
})

export default router;