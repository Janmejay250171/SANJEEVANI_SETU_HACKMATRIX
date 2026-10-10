import { Router } from 'express';
import { askAssistant } from '../controllers/assistantController.js';

const router = Router();

// POST /api/assistant/chat — Universal Ask SehatSure Voice and Text Assistant
router.post('/chat', askAssistant);

export default router;
