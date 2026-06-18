import express, { Request, Response } from 'express'
import { db } from '../db/db'

const router = express.Router()

router.get('/sessions', async (req: Request, res: Response) => {
    const domain = req.query.domain as string

    if (!domain) {
        return res.status(400).json({ error: 'Missing domain parameter' })
    }

    // Fetch all sessions for the domain
    const sessionsQuery = await db.query(`SELECT DISTINCT
         session_id, 
         MIN(time) as started, 
         MAX(time) as ended, 
         COUNT(*) as event_count
        FROM events 
        WHERE domain=$1 
        GROUP BY session_id 
        ORDER BY started DESC`, [domain])

    if (!sessionsQuery) {
        return res.status(500).json({ error: 'Failed to fetch sessions' })
    }
    return res.status(200).json(sessionsQuery.rows)
})

router.get('/sessions/:id', async (req: Request, res: Response) => {
    const sessionId = req.params.id

    if (!sessionId) {
        return res.status(400).json({ error: 'Missing session ID parameter' })
    }

    const result = await db.query(`
        SELECT * FROM events WHERE session_id = $1 ORDER BY time ASC`, [sessionId])

    if (!result) {
        return res.status(404).json({ error: 'Session not found' })
    }

    return res.status(200).json(result.rows)
})

export default router