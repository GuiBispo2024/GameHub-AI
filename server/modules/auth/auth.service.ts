import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { prisma } from '../../db/prisma';
import { hasUserRoleColumn } from '../../db/user-compat';
import { ENV } from '../../config/env';
import { RegisterInput, LoginInput } from './auth.schema';

export interface UserPublicData {
  id: string;
  email: string;
  username: string;
  role: 'USER' | 'ADMIN';
  avatarUrl: string | null;
  bio: string | null;
  createdAt: Date;
  preferences?: any;
}

export interface AuthResult {
  user: UserPublicData;
  token: string;
}

export class AuthService {
  /**
   * Registers a new user with Argon2id password hash and default preferences.
   */
  static async register(input: RegisterInput): Promise<AuthResult> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const normalizedUsername = input.username.trim();

    const includeRole = await hasUserRoleColumn();

    // 1. Check for email duplication
    const existingEmail = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (existingEmail) {
      const error: any = new Error('Este endereço de email já está cadastrado.');
      error.statusCode = 409;
      error.field = 'email';
      throw error;
    }

    // 2. Check for username duplication
    const existingUsername = await prisma.user.findUnique({
      where: { username: normalizedUsername },
      select: { id: true },
    });
    if (existingUsername) {
      const error: any = new Error('Este nome de usuário já está em uso.');
      error.statusCode = 409;
      error.field = 'username';
      throw error;
    }

    // 3. Hash password using Argon2id
    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4,
    });

    // 4. Create User and default UserPreference in an atomic transaction
    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          username: normalizedUsername,
          passwordHash,
        },
        select: {
          id: true,
          email: true,
          username: true,
          avatarUrl: true,
          bio: true,
          createdAt: true,
          ...(includeRole ? { role: true } : {}),
        },
      });

      const preferences = await tx.userPreference.create({
        data: {
          userId: user.id,
          theme: 'dark',
          defaultSpoilerLevel: 'CURRENT_CHAPTER',
          preferredPlatforms: ['PC'],
          preferredGenres: ['RPG', 'Ação'],
          language: 'pt-BR',
          overlayEnabled: true,
          overlayHotkey: 'Alt+G',
          notificationsEnabled: true,
        },
      });

      return {
        ...user,
        preferences,
      };
    });

    // 5. Generate JWT token
    const token = jwt.sign(
      {
        userId: newUser.id,
        email: newUser.email,
        username: newUser.username,
      },
      ENV.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        role: includeRole && (newUser as any).role === 'ADMIN' ? 'ADMIN' : 'USER',
        avatarUrl: newUser.avatarUrl,
        bio: newUser.bio,
        createdAt: newUser.createdAt,
        preferences: newUser.preferences,
      },
      token,
    };
  }

  /**
   * Authenticates user with email and password via Argon2id verification.
   */
  static async login(input: LoginInput): Promise<AuthResult> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const includeRole = await hasUserRoleColumn();

    // 1. Look up user by email
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        username: true,
        passwordHash: true,
        avatarUrl: true,
        bio: true,
        createdAt: true,
        ...(includeRole ? { role: true } : {}),
        preferences: true,
      },
    });

    // Uniform 401 error message to prevent account enumeration
    const invalidCredentialsError: any = new Error(
      'Credenciais inválidas. Verifique seu email e senha.'
    );
    invalidCredentialsError.statusCode = 401;

    if (!user) {
      throw invalidCredentialsError;
    }

    // 2. Verify password hash using Argon2id
    const isValid = await argon2.verify(user.passwordHash, input.password);
    if (!isValid) {
      throw invalidCredentialsError;
    }

    // 3. Ensure preferences exist (creates default if somehow missing)
    let preferences = user.preferences;
    if (!preferences) {
      preferences = await prisma.userPreference.create({
        data: {
          userId: user.id,
          theme: 'dark',
          defaultSpoilerLevel: 'CURRENT_CHAPTER',
          preferredPlatforms: ['PC'],
          preferredGenres: ['RPG'],
        },
      });
    }

    // 4. Generate JWT token (7 days validity)
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        username: user.username,
      },
      ENV.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: includeRole && (user as any).role === 'ADMIN' ? 'ADMIN' : 'USER',
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        createdAt: user.createdAt,
        preferences,
      },
      token,
    };
  }

  /**
   * Retrieves authenticated user data and preferences by ID.
   */
  static async getMe(userId: string): Promise<UserPublicData> {
    const includeRole = await hasUserRoleColumn();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        avatarUrl: true,
        bio: true,
        createdAt: true,
        ...(includeRole ? { role: true } : {}),
        preferences: true,
      },
    });

    if (!user) {
      const error: any = new Error('Usuário não encontrado.');
      error.statusCode = 404;
      throw error;
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: includeRole && (user as any).role === 'ADMIN' ? 'ADMIN' : 'USER',
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      createdAt: user.createdAt,
      preferences: user.preferences,
    };
  }
}
