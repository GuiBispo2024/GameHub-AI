import { prisma } from '../../db/prisma';
import { UpdateUserInput, UpdatePreferencesInput } from './user.schema';

export class UserService {
  /**
   * Helper to map friendly spoiler levels (NONE, LIGHT, ALL) to schema enum values
   */
  static mapSpoilerLevel(level?: string): any {
    if (!level) return undefined;
    switch (level) {
      case 'NONE':
        return 'STRICT_NO_SPOILERS';
      case 'LIGHT':
        return 'CURRENT_CHAPTER';
      case 'ALL':
        return 'FULL_UNRESTRICTED';
      default:
        return level;
    }
  }

  /**
   * Helper to format schema enum values back to friendly spoiler levels
   */
  static formatSpoilerLevel(level: string): 'NONE' | 'LIGHT' | 'ALL' {
    switch (level) {
      case 'STRICT_NO_SPOILERS':
        return 'NONE';
      case 'CURRENT_CHAPTER':
      case 'MID_GAME_SAFE':
        return 'LIGHT';
      case 'FULL_UNRESTRICTED':
        return 'ALL';
      default:
        return 'LIGHT';
    }
  }

  static async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { preferences: true },
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
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      createdAt: user.createdAt,
      preferences: user.preferences
        ? {
            ...user.preferences,
            spoilerLevelFriendly: UserService.formatSpoilerLevel(user.preferences.defaultSpoilerLevel),
          }
        : null,
    };
  }

  static async updateProfile(userId: string, input: UpdateUserInput) {
    // 1. Verify user exists
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!currentUser) {
      const error: any = new Error('Usuário não encontrado.');
      error.statusCode = 404;
      throw error;
    }

    // 2. If username is being changed, verify uniqueness
    if (input.username && input.username.trim() !== currentUser.username) {
      const normalizedUsername = input.username.trim();
      const duplicate = await prisma.user.findUnique({
        where: { username: normalizedUsername },
      });

      if (duplicate && duplicate.id !== userId) {
        const error: any = new Error('Este nome de usuário já está em uso por outro jogador.');
        error.statusCode = 409;
        error.field = 'username';
        throw error;
      }
    }

    // 3. Update user fields
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.username ? { username: input.username.trim() } : {}),
        ...(input.bio !== undefined ? { bio: input.bio } : {}),
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl || null } : {}),
      },
      include: { preferences: true },
    });

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      username: updatedUser.username,
      avatarUrl: updatedUser.avatarUrl,
      bio: updatedUser.bio,
      createdAt: updatedUser.createdAt,
      preferences: updatedUser.preferences
        ? {
            ...updatedUser.preferences,
            spoilerLevelFriendly: UserService.formatSpoilerLevel(updatedUser.preferences.defaultSpoilerLevel),
          }
        : null,
    };
  }

  static async getPreferences(userId: string) {
    let preferences = await prisma.userPreference.findUnique({
      where: { userId },
    });

    if (!preferences) {
      preferences = await prisma.userPreference.create({
        data: {
          userId,
          theme: 'dark',
          defaultSpoilerLevel: 'CURRENT_CHAPTER',
          preferredPlatforms: ['PC'],
          preferredGenres: ['RPG'],
          language: 'pt-BR',
        },
      });
    }

    return {
      ...preferences,
      spoilerLevelFriendly: UserService.formatSpoilerLevel(preferences.defaultSpoilerLevel),
    };
  }

  static async updatePreferences(userId: string, input: UpdatePreferencesInput) {
    const dataToUpdate: any = {};

    if (input.theme !== undefined) dataToUpdate.theme = input.theme;
    if (input.language !== undefined) dataToUpdate.language = input.language;
    if (input.preferredPlatforms !== undefined) dataToUpdate.preferredPlatforms = input.preferredPlatforms;
    if (input.preferredGenres !== undefined) dataToUpdate.preferredGenres = input.preferredGenres;
    if (input.overlayEnabled !== undefined) dataToUpdate.overlayEnabled = input.overlayEnabled;
    if (input.overlayHotkey !== undefined) dataToUpdate.overlayHotkey = input.overlayHotkey;
    if (input.notificationsEnabled !== undefined) dataToUpdate.notificationsEnabled = input.notificationsEnabled;

    const spoilerLevelToSet = input.defaultSpoilerLevel || input.spoilerLevel;
    if (spoilerLevelToSet !== undefined) {
      dataToUpdate.defaultSpoilerLevel = UserService.mapSpoilerLevel(spoilerLevelToSet);
    }

    const updated = await prisma.userPreference.upsert({
      where: { userId },
      update: dataToUpdate,
      create: {
        userId,
        theme: input.theme || 'dark',
        defaultSpoilerLevel: UserService.mapSpoilerLevel(spoilerLevelToSet) || 'CURRENT_CHAPTER',
        preferredPlatforms: input.preferredPlatforms || ['PC'],
        preferredGenres: input.preferredGenres || ['RPG'],
        language: input.language || 'pt-BR',
        overlayEnabled: input.overlayEnabled ?? true,
        overlayHotkey: input.overlayHotkey || 'Alt+G',
        notificationsEnabled: input.notificationsEnabled ?? true,
      },
    });

    return {
      ...updated,
      spoilerLevelFriendly: UserService.formatSpoilerLevel(updated.defaultSpoilerLevel),
    };
  }
}
