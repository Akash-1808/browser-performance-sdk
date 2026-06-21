import express from 'express';
import cors from 'cors';
import ingestRoute from './routes/ingest'
import { migrate } from './db/db';
import metricsRoute from './routes/metrics'
import { setupWebsocket } from './ws';
import sessionsRoute from './routes/sessions'
import errorsRoute from './routes/errors'
import userRoute from './routes/user'
import projectsRoute from './routes/projects'
import cookieParser from 'cookie-parser'

const app = express();
const PORT = 3000;

// PRIVATE endpoints — dashboard needs credentials (cookies) so origin must be exact
// Skip /api/ingest since it has its own open CORS in the route file
const dashboardOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use((req, res, next) => {
    if (req.path.startsWith('/api/ingest')) return next();
    cors({
        origin: [dashboardOrigin, 'http://localhost:5173'],
        methods: ['POST', 'OPTIONS', 'GET'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true
    })(req, res, next);
});

// Parse cookies
app.use(cookieParser());

// 3. Parse incoming JSON payloads (from our sendBeacon Blob)
app.use(express.json());
// Fallback text parser just in case the browser drops the content-type
app.use(express.text({ type: 'text/plain' }));

// 5. The ingest route
app.use('/api', ingestRoute)

app.use('/api/auth', userRoute)
app.use('/api', projectsRoute)
app.use('/api', metricsRoute)
app.use('/api', sessionsRoute)
app.use('/api', errorsRoute)

async function start() {
    await migrate();
    const server = app.listen(PORT, () => {
        console.log(`🚀 API Ingestion server running at http://localhost:${PORT}`);
        console.log(`Ready to receive events from test.html...`);
    })
    setupWebsocket(server)
}

start().catch((err) => {
    console.error("start fail:", err)
    process.exit(1);
})

