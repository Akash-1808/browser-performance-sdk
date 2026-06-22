import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/db';

export const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev';

// Extend Express Request to hold the user info
declare global {
    namespace Express {
        interface Request {
            user?: { id: string; email: string };
        }
    }
}

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
    // Frictionless Demo Bypass:
    // If a request wants data for the global demo project or the specific demo domain, let them through!
    const requestedProjectId = req.query.projectId || req.body.projectId;
    const domain = req.query.domain as string || req.body.domain as string;

    if (requestedProjectId === '00000000-0000-0000-0000-000000000000' || domain === 'browser-performance-sdk.vercel.app' || domain === 'localhost') {
        return next();
    }

    const token = req.cookies?.token;

    if (!token) {
        res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
        return;
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Unauthorized: Invalid token' });
        return;
    }
};

export const authorizeDomain = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const domain = req.query.domain as string || req.body.domain as string;

    // Frictionless Demo Bypass
    if (domain === 'browser-performance-sdk.vercel.app' || domain === 'localhost') {
        next();
        return;
    }

    if (!domain) {
        res.status(400).json({ error: 'Missing domain parameter' });
        return;
    }

    if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    try {
        const result = await db.query('SELECT id FROM projects WHERE domain = $1 AND user_id = $2', [domain, req.user.id]);
        if (result.rows.length === 0) {
            res.status(403).json({ error: 'Forbidden: You do not own this domain' });
            return;
        }
        next();
    } catch (err) {
        console.error('Authorization error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};
