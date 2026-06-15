import express, { Request, Response } from "express";
import { checkRateLimit } from "../rateLimit/rateLimit";
import { db } from "../db/db";
import { broadcast } from "../ws";



const router = express.Router();

router.post('/ingest', async (req: Request, res: Response) => {
    let payload = req.body

    if (typeof payload == 'string') {
        try {
            payload = JSON.parse(payload)
        } catch (err) {
            res.status(400).send()
            return
        }
    }

    const { domain, projectId, sessionId, events } = payload

    if (!domain || !projectId || !sessionId || !events) {
        res.status(400).send()
        return
    }

    const allowed = checkRateLimit(domain, events.length)
    if (!allowed) {
        res.status(429).send()
        return
    }
    try {
        const val: any[] = []
        const placeholder: string[] = []
        let idx = 1;

        for (const event of events) {
            placeholder.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`)
            val.push(
                domain,
                projectId,
                sessionId,
                event.type,
                event.value ?? null,
                event.meta ? JSON.stringify(event.meta) : null
            )
        }

        await db.query(`
        INSERT INTO events (domain, project_id, session_id, metric, value, meta)
        VALUES ${placeholder.join(', ')} 
    `, val)

        broadcast(domain, events)
        res.status(200).json({ success: true })
    } catch (err) {
        console.error("Ingest DB Error:", err)
        res.status(500).json({ error: 'Internal Server Error' })
    }
})

export default router