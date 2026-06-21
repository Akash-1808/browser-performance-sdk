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

// Top-level logger to debug Render requests
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} (Origin: ${req.headers.origin})`);
    next();
});

// ===== 1. INGEST CORS — completely open to the public =====
app.use('/api/ingest', cors({
    origin: '*',
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-requested-with', 'Accept']
}));

// ===== 2. DASHBOARD CORS — restricted to frontend url =====
// Remove any trailing slash from the env variable just in case
const rawFrontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
const dashboardOrigin = rawFrontendUrl.endsWith('/') ? rawFrontendUrl.slice(0, -1) : rawFrontendUrl;

app.use((req, res, next) => {
    // Skip if it's the ingest route (already handled above)
    if (req.originalUrl.includes('/api/ingest')) return next();
    
    cors({
        origin: [dashboardOrigin, 'http://localhost:5173'],
        methods: ['POST', 'OPTIONS', 'GET', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true
    })(req, res, next);
});

// Parse cookies
app.use(cookieParser());

// 3. Parse incoming JSON payloads (from our sendBeacon Blob)
// Increased limit to 10mb because SDK payloads (events, DOM snapshots) can be large!
// If the payload exceeds the limit, Express throws a 413 error which the browser sees as a CORS error.
app.use(express.json({ limit: '10mb' }));
// Fallback text parser just in case the browser drops the content-type
app.use(express.text({ type: 'text/plain', limit: '10mb' }));

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

