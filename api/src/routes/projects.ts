import express, { Request, Response } from 'express';
import { db } from '../db/db';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Fetch all projects for the logged-in user
router.get('/projects', authenticate, async (req: Request, res: Response) => {
    try {
        // req.user is populated by the authenticate middleware
        const userId = req.user?.id;
        
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // Note: The table name is 'projects', not 'project'!
        const result = await db.query(
            'SELECT * FROM projects WHERE user_id=$1 ORDER BY created_at DESC', 
            [userId]
        );

        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Fetch projects error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create a new project for the logged-in user
router.post('/projects', authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const { name, domain } = req.body;

        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        if (!name || !domain) {
            res.status(400).json({ error: 'Project name and domain are required' });
            return;
        }

        const result = await db.query(
            'INSERT INTO projects (user_id, name, domain) VALUES ($1, $2, $3) RETURNING *',
            [userId, name, domain]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Create project error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;