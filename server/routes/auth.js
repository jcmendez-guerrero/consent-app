import { Router } from 'express';
import { currentUser } from '../middleware/auth.js';

const router = Router();

router.get('/', (req, res) => {
  res.json({ user: currentUser(req) });
});

export default router;
