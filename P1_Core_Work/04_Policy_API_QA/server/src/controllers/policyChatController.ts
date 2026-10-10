import { Request, Response } from 'express';
import { policyChatService } from '../services/policyChatService.js';

export async function askPolicyQuestion(req: Request, res: Response): Promise<void> {
  try {
    const policyId = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
    const { message, history, overrides } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({
        error: {
          code: 'MESSAGE_REQUIRED',
          message: 'Please provide a non-empty question in the "message" field.'
        }
      });
      return;
    }

    const response = await policyChatService.answerQuestion({
      policyId,
      message: message.trim(),
      history: Array.isArray(history) ? history : [],
      overrides: overrides && typeof overrides === 'object' ? overrides : undefined
    });

    res.status(200).json(response);
  } catch (err: any) {
    console.error('[Ask SehatSure Chat Error]:', err);
    res.status(500).json({
      error: {
        code: 'CHAT_ASSISTANT_ERROR',
        message: "SehatSure couldn't determine this from the available policy information right now."
      }
    });
  }
}
