import { Request, Response } from 'express';
import { AssistantChatRequestZod } from '../schemas/assistantSchema.js';
import { assistantService } from '../services/assistantService.js';
import { getUserFromRequest } from './authController.js';

export async function askAssistant(req: Request, res: Response): Promise<void> {
  try {
    const parseResult = AssistantChatRequestZod.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid assistant chat request format.',
          details: parseResult.error.format()
        }
      });
      return;
    }

    const user = await getUserFromRequest(req);
    const userId = user ? user._id?.toString() : null;

    const response = await assistantService.handleChat(parseResult.data, userId);

    res.status(200).json({
      status: 'success',
      data: response
    });
  } catch (err: any) {
    console.error('[AssistantController Error]:', err);
    res.status(500).json({
      error: {
        code: 'ASSISTANT_ERROR',
        message: "SehatSure assistant encountered an unexpected error processing your request. Please try again."
      }
    });
  }
}
