import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import supertest from 'supertest'

// 1. Mock BEFORE importing the router
vi.mock('../src/db/db', () => ({
    db: { query: vi.fn() }
}))

vi.mock('../src/rateLimit/rateLimit', () => ({
    checkRateLimit: vi.fn(),
}))

// 2. Import after mocks are set up
import router from '../src/routes/ingest'
import { db } from '../src/db/db'
import { checkRateLimit } from '../src/rateLimit/rateLimit'
import { broadcast } from '../src/ws'

// 3. Build a mini Express app just for testing
const app = express()
app.use(express.json())
app.use(express.text({ type: "text/plain" }))
app.use('/', router)

// Helper - a valid payload
const validPayload = {
    domain: 'test.com',
    projectId: 'proj-1',
    sessionId: '550e8400-e29b-41d4-a716-446655440000',
    events: [
        { type: 'FCP', value: 1200, meta: { path: '/' } }
    ]
}

describe('POST /ingest', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Default: allow requests, DB succeeds
        vi.mocked(checkRateLimit).mockReturnValue(true)
        vi.mocked(db.query).mockResolvedValue({} as any)
    })

    it('returns 400 for missing required fields', async () => {
        const res = await supertest(app)
            .post('/ingest')
            .send({ domain: 'test.com' }) // missing project_id, session_id, events

        expect(res.status).toBe(400)
    })

    it('retruns 429 when rate limited', async () => {
        vi.mocked(checkRateLimit).mockReturnValue(false)

        const res = await supertest(app)
            .post('/ingest')
            .send(validPayload)

        expect(res.status).toBe(429)
    })

    it('retruns 200 and inserts events on success ', async () => {
        const res = await supertest(app)
            .post('/ingest')
            .send(validPayload)

        expect(res.status).toBe(200)
        expect(res.body).toEqual({ success: true })

        // Verify db.query was called with an INSERT
        expect(db.query).toHaveBeenCalledOnce()
        const [sql, params] = vi.mocked(db.query).mock.calls[0]
        expect(sql).toContain('INSERT INTO events')
        expect(params).toContain('test.com')
    })

    it('return 500 when db fails', async () => {
        vi.mocked(db.query).mockRejectedValue(new Error('DB down'))

        const res = await supertest(app)
            .post('/ingest')
            .send(validPayload)

        expect(res.status).toBe(500)
    })
})
