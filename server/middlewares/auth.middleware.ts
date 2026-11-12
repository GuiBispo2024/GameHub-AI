import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { prisma } from '../db/prisma';

export interface AuthUserPayload {
  id: string;
  email: string;
  username: string;
}

// Augment Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}

interface JwtTokenPayload {
  userId: string;
  email: string;
  username: string;
  iat: number;
  exp: number;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // 1. Try to read token from HttpOnly cookie first, then Bearer Authorization header
    let token: string | undefined = req.cookies?.gamehub_token;

    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }
    }

    if (!token) {
      res.status(401).json({
        status: 'error',
        message: 'Acesso não autorizado. Token de autenticação não fornecido.',
      });
      return;
    }

    // 2. Verify JWT signature and expiration
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as JwtTokenPayload;

    if (!decoded || !decoded.userId) {
      res.status(401).json({
        status: 'error',
        message: 'Acesso não autorizado. Token inválido.',
      });
      return;
    }

    // 3. Confirm user exists in PostgreSQL
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, username: true },
    });

    if (!user) {
      res.status(401).json({
        status: 'error',
        message: 'Acesso não autorizado. Usuário associado ao token não encontrado.',
      });
      return;
    }

    // 4. Attach authenticated user to request
    req.user = {
      id: user.id,
      email: user.email,
      username: user.username,
    };

    next();
  } catch (err: unknown) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        status: 'error',
        message: 'Sessão expirada. Por favor, realize o login novamente.',
        code: 'TOKEN_EXPIRED',
      });
      return;
    }

    if (err instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        status: 'error',
        message: 'Acesso não autorizado. Assinatura do token inválida.',
        code: 'TOKEN_INVALID',
      });
      return;
    }

    res.status(500).json({
      status: 'error',
      message: 'Erro interno ao validar autenticação.',
    });
  }
}
