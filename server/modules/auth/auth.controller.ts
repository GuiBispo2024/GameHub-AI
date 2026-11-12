import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { AuthService } from './auth.service';
import { registerSchema, loginSchema } from './auth.schema';

const COOKIE_NAME = 'gamehub_token';

function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    // SameSite 'lax' is standard for top-level navigation; in embedded iframe HTTPS environments 'none' with secure is required
    sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  };
}

export class AuthController {
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = registerSchema.parse(req.body);
      const result = await AuthService.register(validatedData);

      // Set secure HttpOnly cookie
      res.cookie(COOKIE_NAME, result.token, getCookieOptions());

      res.status(201).json({
        status: 'success',
        message: 'Usuário cadastrado com sucesso.',
        user: result.user,
        token: result.token,
      });
    } catch (err: any) {
      if (err instanceof ZodError) {
        res.status(400).json({
          status: 'error',
          message: 'Dados de cadastro inválidos.',
          errors: err.flatten().fieldErrors,
        });
        return;
      }

      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({
        status: 'error',
        message: err.message || 'Erro interno no servidor ao processar o cadastro.',
        field: err.field,
      });
    }
  }

  static async login(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = loginSchema.parse(req.body);
      const result = await AuthService.login(validatedData);

      // Set secure HttpOnly cookie
      res.cookie(COOKIE_NAME, result.token, getCookieOptions());

      res.status(200).json({
        status: 'success',
        message: 'Autenticação realizada com sucesso.',
        user: result.user,
        token: result.token,
      });
    } catch (err: any) {
      if (err instanceof ZodError) {
        res.status(400).json({
          status: 'error',
          message: 'Dados de login inválidos.',
          errors: err.flatten().fieldErrors,
        });
        return;
      }

      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({
        status: 'error',
        message: err.message || 'Erro ao realizar login.',
      });
    }
  }

  static async logout(req: Request, res: Response): Promise<void> {
    try {
      const { maxAge: _omitted, ...clearOptions } = getCookieOptions();
      res.clearCookie(COOKIE_NAME, clearOptions);

      res.status(200).json({
        status: 'success',
        message: 'Sessão encerrada com sucesso.',
        note: 'O cookie HttpOnly de sessão foi removido do navegador. Clientes stateless devem descartar o token armazenado em memória.',
      });
    } catch (err: any) {
      res.status(500).json({
        status: 'error',
        message: 'Erro ao processar logout.',
      });
    }
  }

  static async me(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.id) {
        res.status(401).json({
          status: 'error',
          message: 'Usuário não autenticado.',
        });
        return;
      }

      const user = await AuthService.getMe(req.user.id);

      res.status(200).json({
        status: 'success',
        user,
      });
    } catch (err: any) {
      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({
        status: 'error',
        message: err.message || 'Erro ao consultar dados da sessão.',
      });
    }
  }
}
