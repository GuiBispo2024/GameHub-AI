import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { UserService } from './user.service';
import { updateUserSchema, updatePreferencesSchema } from './user.schema';

export class UserController {
  static async getMe(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.id) {
        res.status(401).json({ status: 'error', message: 'Não autorizado.' });
        return;
      }

      const profile = await UserService.getProfile(req.user.id);
      res.status(200).json({
        status: 'success',
        user: profile,
      });
    } catch (err: any) {
      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({
        status: 'error',
        message: err.message || 'Erro ao carregar perfil.',
      });
    }
  }

  static async updateMe(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.id) {
        res.status(401).json({ status: 'error', message: 'Não autorizado.' });
        return;
      }

      const validated = updateUserSchema.parse(req.body);
      const updated = await UserService.updateProfile(req.user.id, validated);

      res.status(200).json({
        status: 'success',
        message: 'Perfil atualizado com sucesso.',
        user: updated,
      });
    } catch (err: any) {
      if (err instanceof ZodError) {
        res.status(400).json({
          status: 'error',
          message: 'Dados de atualização inválidos.',
          errors: err.flatten().fieldErrors,
        });
        return;
      }

      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({
        status: 'error',
        message: err.message || 'Erro ao atualizar perfil.',
        field: err.field,
      });
    }
  }

  static async getPreferences(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.id) {
        res.status(401).json({ status: 'error', message: 'Não autorizado.' });
        return;
      }

      const preferences = await UserService.getPreferences(req.user.id);
      res.status(200).json({
        status: 'success',
        preferences,
      });
    } catch (err: any) {
      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({
        status: 'error',
        message: err.message || 'Erro ao carregar preferências.',
      });
    }
  }

  static async updatePreferences(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.id) {
        res.status(401).json({ status: 'error', message: 'Não autorizado.' });
        return;
      }

      const validated = updatePreferencesSchema.parse(req.body);
      const updated = await UserService.updatePreferences(req.user.id, validated);

      res.status(200).json({
        status: 'success',
        message: 'Preferências atualizadas com sucesso.',
        preferences: updated,
      });
    } catch (err: any) {
      if (err instanceof ZodError) {
        res.status(400).json({
          status: 'error',
          message: 'Preferências com formato inválido.',
          errors: err.flatten().fieldErrors,
        });
        return;
      }

      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({
        status: 'error',
        message: err.message || 'Erro ao salvar preferências.',
      });
    }
  }
}
