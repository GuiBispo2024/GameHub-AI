import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app';
import { prisma } from '../server/db/prisma';
import { assertDatabaseIsolation } from './helpers/testDatabase';
import { gameAgent } from '../server/modules/agent/agent.service';
import {
  AIGenerateParams,
  AIGenerateResult,
  AIProvider,
  AIToolExecutionTrace,
} from '../server/modules/agent/ai.provider';
import { GeminiProvider } from '../server/modules/agent/gemini.provider';
import { ToolsRegistry, defaultToolsRegistry } from '../server/modules/agent/tools/tools.registry';
import { createSearchGamesTool } from '../server/modules/agent/tools/search-games.tool';
import { createSearchGameKnowledgeTool } from '../server/modules/agent/tools/search-game-knowledge.tool';
import { createGetUserLibraryTool } from '../server/modules/agent/tools/get-user-library.tool';
import { createGetUserPreferencesTool } from '../server/modules/agent/tools/get-user-preferences.tool';
import { createGetJourneyContextTool } from '../server/modules/agent/tools/get-journey-context.tool';
import { createGetGameBuildsTool } from '../server/modules/agent/tools/get-game-builds.tool';
import { createAddGameToLibraryTool } from '../server/modules/agent/tools/add-game-to-library.tool';
import { createUpdateGameProgressTool } from '../server/modules/agent/tools/update-game-progress.tool';
import { createToolError } from '../server/modules/agent/tools/tools.types';
import { GamesService } from '../server/modules/games/games.service';
import { GameCatalogProvider } from '../server/modules/games/providers/game-catalog.provider';
import {
  GenreItem,
  NormalizedGame,
  PlatformItem,
  SearchGamesQuery,
  SearchGamesResult,
} from '../server/modules/games/games.types';

const app = createApp();

class MockFunctionCallingProvider implements AIProvider {
  readonly providerName = 'mock-gemini-fc';
  public calls: AIGenerateParams[] = [];
  public handler: (params: AIGenerateParams) => Promise<AIGenerateResult>;

  constructor() {
    this.handler = async () => ({
      text: 'Resposta padrão em português.',
      model: 'gemini-4-hydrogen',
      usage: { promptTokens: 100, candidatesTokens: 40, totalTokens: 140 },
      finishReason: 'STOP',
    });
  }

  async generateReply(params: AIGenerateParams): Promise<AIGenerateResult> {
    this.calls.push(params);
    return this.handler(params);
  }
}

class MockCatalogProvider implements GameCatalogProvider {
  readonly seededIgdbId: number;
  constructor(seededIgdbId: number) {
    this.seededIgdbId = seededIgdbId;
  }

  async searchGames(query: SearchGamesQuery): Promise<SearchGamesResult> {
    const item: NormalizedGame = {
      igdbId: this.seededIgdbId,
      title: `Chrono Trigger (${query.query})`,
      slug: `chrono-trigger-fc-${this.seededIgdbId}`,
      summary: 'Clássico RPG de viagem no tempo com múltiplos finais.',
      storyline: null,
      coverUrl: null,
      backdropUrl: null,
      rating: 96,
      releaseDate: '1995-03-11T00:00:00.000Z',
      genres: query.genre ? [query.genre] : ['RPG', 'Adventure'],
      platforms: query.platform ? [query.platform] : ['PC', 'SNES'],
      developer: 'Square',
      publisher: 'Square',
    };
    return {
      data: [item],
      pagination: {
        page: query.page ?? 1,
        limit: query.limit ?? 10,
        hasNextPage: false,
      },
    };
  }

  async getGameByIgdbId(): Promise<NormalizedGame | null> {
    return null;
  }

  async getGenres(): Promise<GenreItem[]> {
    return [{ id: 12, name: 'RPG', slug: 'role-playing-rpg' }];
  }

  async getPlatforms(): Promise<PlatformItem[]> {
    return [{ id: 6, name: 'PC', slug: 'win', abbreviation: 'PC' }];
  }
}

describe('GameHub AI — Function Calling, Ferramentas e Confirmação Persistente (Fase 3, Tarefa 8)', () => {
  const ts = Date.now();
  const mockProvider = new MockFunctionCallingProvider();
  const mockIgdbId = 880000 + (ts % 90000);
  const mockGamesService = new GamesService(new MockCatalogProvider(mockIgdbId));

  const userA = {
    username: `fc_user_a_${ts}`,
    email: `fc_user_a_${ts}@example.com`,
    password: 'ToolsPass123!',
    confirmPassword: 'ToolsPass123!',
  };

  const userB = {
    username: `fc_user_b_${ts}`,
    email: `fc_user_b_${ts}@example.com`,
    password: 'ToolsPass123!',
    confirmPassword: 'ToolsPass123!',
  };

  let userAId = '';
  let userAToken = '';
  let userBId = '';
  let userBToken = '';

  let gameInLibraryId = '';
  let gameCatalogOnlyId = '';
  let gameForCancelId = '';
  let gameForDupId = '';
  let searchedGameId = '';

  let userAEntryId = '';
  let userBEntryId = '';
  let userAJourneyId = '';
  let userBJourneyId = '';

  let conversationWithToolsId = '';

  beforeAll(async () => {
    const isolation = assertDatabaseIsolation();
    expect(isolation.safe).toBe(true);
    expect(isolation.testEndpoint).toBe('ep-mute-frost-b6xo7qjs');
    expect(isolation.testEndpoint).not.toBe(isolation.prodEndpoint);

    const resA = await request(app).post('/api/auth/register').send(userA);
    expect(resA.status).toBe(201);
    userAId = resA.body.user.id;
    userAToken = resA.body.token;

    const resB = await request(app).post('/api/auth/register').send(userB);
    expect(resB.status).toBe(201);
    userBId = resB.body.user.id;
    userBToken = resB.body.token;

    await request(app)
      .patch('/api/users/me/preferences')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        preferredPlatforms: ['PC', 'Steam Deck'],
        preferredGenres: ['RPG', 'Roguelike'],
        spoilerLevel: 'LIGHT',
        language: 'pt-BR',
      });

    const g1 = await prisma.game.create({
      data: {
        igdbId: 770001 + (ts % 10000),
        name: 'Balatro Roguelike Deckbuilder',
        slug: `balatro-fc-${ts}`,
        summary: 'Construção de baralho roguelike baseada em mãos de pôquer e coringas.',
        genres: ['Card Game', 'Roguelike', 'Indie'],
        platforms: ['PC', 'Nintendo Switch'],
        developer: 'LocalThunk',
      },
    });
    gameInLibraryId = g1.id;

    const g2 = await prisma.game.create({
      data: {
        igdbId: 770002 + (ts % 10000),
        name: 'Hades II Catalog Candidate',
        slug: `hades-ii-fc-${ts}`,
        summary: 'Roguelike de ação mitológica.',
        genres: ['Roguelike', 'Action'],
        platforms: ['PC'],
        developer: 'Supergiant Games',
      },
    });
    gameCatalogOnlyId = g2.id;

    const g3 = await prisma.game.create({
      data: {
        igdbId: 770003 + (ts % 10000),
        name: 'Hollow Knight Silksong Candidate',
        slug: `silksong-fc-${ts}`,
        summary: 'Metroidvania de ação e plataforma.',
        genres: ['Metroidvania', 'Adventure'],
        platforms: ['PC', 'Nintendo Switch'],
        developer: 'Team Cherry',
      },
    });
    gameForCancelId = g3.id;

    const g4 = await prisma.game.create({
      data: {
        igdbId: 770004 + (ts % 10000),
        name: 'Disco Elysium Concurrency Test',
        slug: `disco-elysium-fc-${ts}`,
        summary: 'RPG narrativo investigativo.',
        genres: ['RPG'],
        platforms: ['PC'],
        developer: 'ZA/UM',
      },
    });
    gameForDupId = g4.id;

    const libA = await request(app)
      .post('/api/library')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        gameId: gameInLibraryId,
        status: 'PLAYING',
        hoursPlayed: 19,
        rating: 9,
      });
    expect(libA.status).toBe(201);
    userAEntryId = libA.body.data.id;

    const libB = await request(app)
      .post('/api/library')
      .set('Authorization', `Bearer ${userBToken}`)
      .send({
        gameId: gameInLibraryId,
        status: 'COMPLETED',
        hoursPlayed: 60,
        rating: 10,
      });
    expect(libB.status).toBe(201);
    userBEntryId = libB.body.data.id;

    const jrnA = await request(app)
      .post('/api/journeys')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        userGameId: userAEntryId,
        name: 'Run Deck Flush',
        characterName: 'Carta Alta',
        characterClass: 'Baralho Xadrez',
        currentLevel: 7,
        currentArea: 'Ante 6',
        currentObjective: 'Fechar Ante 8 sem perder multiplicador',
        playtimeHours: 19,
      });
    expect(jrnA.status).toBe(201);
    userAJourneyId = jrnA.body.data.id;

    await request(app)
      .post(`/api/journeys/${userAJourneyId}/builds`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        name: 'Sinergia de Coringas Multiplicadores',
        playstyle: 'Flush / Cartas de Copas',
        attributes: {
          DeckSize: 48,
          MainHandLevel: 'Flush Nível 11',
          GoldReserve: 45,
        },
        equipment: {
          joker1: 'Blueprint',
          joker2: 'Bloodstone',
          voucher: 'Grabber',
        },
      });

    await request(app)
      .post(`/api/journeys/${userAJourneyId}/progress`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        areaName: 'Ante 5',
        questName: 'Boss Blind The Wall',
        description: 'Derrotado com 180 mil fichas usando Flush de Copas.',
        completionPercent: 62,
      });

    const jrnB = await request(app)
      .post('/api/journeys')
      .set('Authorization', `Bearer ${userBToken}`)
      .send({
        userGameId: userBEntryId,
        name: 'Jornada Secreta B',
        characterName: 'SigmaB',
        characterClass: 'Deck Plasma',
      });
    expect(jrnB.status).toBe(201);
    userBJourneyId = jrnB.body.data.id;

    const testRegistry = new ToolsRegistry([
      createSearchGamesTool(mockGamesService),
      createSearchGameKnowledgeTool(),
      createGetUserLibraryTool(),
      createGetUserPreferencesTool(),
      createGetJourneyContextTool(),
      createGetGameBuildsTool(),
      createAddGameToLibraryTool(),
      createUpdateGameProgressTool(),
    ]);

    gameAgent.setToolsRegistry(testRegistry);
    gameAgent.setProvider(mockProvider);
  });

  beforeEach(() => {
    mockProvider.calls = [];
    mockProvider.handler = async () => ({
      text: 'Resposta padrão em português.',
      model: 'gemini-4-hydrogen',
      usage: { promptTokens: 80, candidatesTokens: 30, totalTokens: 110 },
      finishReason: 'STOP',
    });
    gameAgent.setProvider(mockProvider);
  });

  afterAll(async () => {
    gameAgent.resetProvider();
    gameAgent.resetToolsRegistry();

    await prisma.agentActionProposal.deleteMany({
      where: { userId: { in: [userAId, userBId] } },
    });
    await prisma.companionSession.deleteMany({
      where: { userId: { in: [userAId, userBId] } },
    });
    await prisma.gameBuild.deleteMany({
      where: { userId: { in: [userAId, userBId] } },
    });
    await prisma.progressLog.deleteMany({
      where: { userId: { in: [userAId, userBId] } },
    });
    await prisma.gameplayJourney.deleteMany({
      where: { userId: { in: [userAId, userBId] } },
    });
    await prisma.userGame.deleteMany({
      where: { userId: { in: [userAId, userBId] } },
    });
    await prisma.game.deleteMany({
      where: {
        id: {
          in: [gameInLibraryId, gameCatalogOnlyId, gameForCancelId, gameForDupId, searchedGameId].filter(
            Boolean
          ),
        },
      },
    });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
  });

  it('1. Registro centralizado contém todas as ferramentas com classificação READ/WRITE e FunctionDeclarations', () => {
    const allTools = defaultToolsRegistry.listTools();
    const names = allTools.map((t) => t.name);

    expect(names).toEqual(
      expect.arrayContaining([
        'searchGames',
        'searchGameKnowledge',
        'getUserLibrary',
        'getUserPreferences',
        'getJourneyContext',
        'getGameBuilds',
        'addGameToLibrary',
        'updateGameProgress',
      ])
    );
    expect(names.length).toBe(8);

    expect(defaultToolsRegistry.getTool('searchGames')?.accessType).toBe('READ');
    expect(defaultToolsRegistry.getTool('searchGameKnowledge')?.accessType).toBe('READ');
    expect(defaultToolsRegistry.getTool('getUserLibrary')?.accessType).toBe('READ');
    expect(defaultToolsRegistry.getTool('getUserPreferences')?.accessType).toBe('READ');
    expect(defaultToolsRegistry.getTool('getJourneyContext')?.accessType).toBe('READ');
    expect(defaultToolsRegistry.getTool('getGameBuilds')?.accessType).toBe('READ');
    expect(defaultToolsRegistry.getTool('addGameToLibrary')?.accessType).toBe('WRITE');
    expect(defaultToolsRegistry.getTool('updateGameProgress')?.accessType).toBe('WRITE');

    const declarations = defaultToolsRegistry.getFunctionDeclarations('COMPANION');
    expect(declarations.length).toBe(8);
  });

  it('2. Seleção e execução de ferramenta pelo agente via Function Calling gera toolsUsed e groundedInRealData', async () => {
    mockProvider.handler = async (params) => {
      expect(params.tools?.length).toBe(8);
      const prefsCall = await params.onToolCall!({
        id: 'call-1',
        name: 'getUserPreferences',
        args: {},
      });
      expect(prefsCall.trace.status).toBe('EXECUTED');
      expect((prefsCall.response.data as any).preferredPlatforms).toContain('Steam Deck');

      const libCall = await params.onToolCall!({
        id: 'call-2',
        name: 'getUserLibrary',
        args: { status: 'PLAYING' },
      });
      expect(libCall.trace.status).toBe('EXECUTED');
      expect((libCall.response.data as any).entries[0].title).toBe('Balatro Roguelike Deckbuilder');

      return {
        text: 'Você prefere Steam Deck e está jogando Balatro Roguelike Deckbuilder (19h).',
        model: 'gemini-4-hydrogen',
        toolExecutions: [prefsCall.trace, libCall.trace],
      };
    };

    const res = await request(app)
      .post('/api/agent/chat')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        mode: 'LIBRARY',
        message: 'Quais são minhas preferências e o que estou jogando agora?',
      });

    expect(res.status).toBe(200);
    expect(res.body.groundedInRealData).toBe(true);
    expect(res.body.toolsUsed.length).toBe(2);
    expect(res.body.toolsUsed.map((t: AIToolExecutionTrace) => t.name)).toEqual([
      'getUserPreferences',
      'getUserLibrary',
    ]);
    expect(res.body.reply.metadata.groundedInRealData).toBe(true);

    conversationWithToolsId = res.body.conversationId;
  });

  it('3. Validação Zod rejeita argumentos inválidos e bloqueia tentativa de injetar userId', async () => {
    expect(() =>
      defaultToolsRegistry.validateAndParseArgs('getUserLibrary', {
        userId: userBId,
        status: 'PLAYING',
      })
    ).toThrow(/userId/i);

    expect(() =>
      defaultToolsRegistry.validateAndParseArgs('searchGames', {
        query: '',
        limit: 99,
      })
    ).toThrow();

    expect(() =>
      defaultToolsRegistry.validateAndParseArgs('addGameToLibrary', {
        gameId: 'nao-e-uuid',
        status: 'INVALID_STATUS',
      })
    ).toThrow();

    expect(() =>
      defaultToolsRegistry.validateAndParseArgs('updateGameProgress', {
        completionPercent: 150,
      })
    ).toThrow();

    // Runtime tool call with invalid args fails safely inside onToolCall
    mockProvider.handler = async (params) => {
      const badCall = await params.onToolCall!({
        id: 'bad-args',
        name: 'addGameToLibrary',
        args: { gameId: 'invalid-uuid', userId: userBId },
      });
      expect(badCall.trace.status).toBe('FAILED');
      expect(badCall.response.status).toBe('error');
      return {
        text: 'Argumentos inválidos detectados com segurança.',
        model: 'gemini-4-hydrogen',
        toolExecutions: [badCall.trace],
      };
    };

    const res = await request(app)
      .post('/api/agent/chat')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ mode: 'LIBRARY', message: 'Teste de validação' });

    expect(res.status).toBe(200);
    expect(res.body.toolsUsed[0].status).toBe('FAILED');
  });

  it('4. Rejeição de ferramenta desconhecida fora da allowlist', async () => {
    expect(() =>
      defaultToolsRegistry.validateAndParseArgs('executeRawSql', { sql: 'DROP TABLE users' })
    ).toThrow(/não reconhecida/i);

    mockProvider.handler = async (params) => {
      const unknownCall = await params.onToolCall!({
        id: 'unknown-1',
        name: 'deleteDatabase',
        args: {},
      });
      expect(unknownCall.trace.status).toBe('REJECTED');
      expect(unknownCall.trace.errorCode).toBe('UNKNOWN_TOOL');
      expect(unknownCall.response.status).toBe('error');

      return {
        text: 'Ferramenta desconhecida foi bloqueada.',
        model: 'gemini-4-hydrogen',
        toolExecutions: [unknownCall.trace],
      };
    };

    const res = await request(app)
      .post('/api/agent/chat')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ mode: 'LIBRARY', message: 'Execute uma ferramenta inexistente' });

    expect(res.status).toBe(200);
    expect(res.body.toolsUsed[0].status).toBe('REJECTED');
  });

  it('5. Ferramenta searchGames reutiliza GamesService, sincroniza catálogo e retorna gameId UUID', async () => {
    const result = await gameAgent.getToolsRegistry().executeReadTool(
      'searchGames',
      { query: 'Chrono', limit: 3, genre: 'RPG', platform: 'PC' },
      { userId: userAId, mode: 'LIBRARY' }
    );

    expect(result.source).toBe('IGDB_CATALOG');
    expect(result.totalReturned).toBe(1);
    const games = result.games as Array<Record<string, any>>;
    expect(games[0].igdbId).toBe(mockIgdbId);
    expect(games[0].gameId).toBeTruthy();
    expect(games[0].genres).toContain('RPG');
    searchedGameId = games[0].gameId;
  });

  it('6. Ferramenta getUserLibrary aplica filtros reais e retorna somente jogos do usuário autenticado', async () => {
    const result = await gameAgent.getToolsRegistry().executeReadTool(
      'getUserLibrary',
      { status: 'PLAYING', genre: 'Roguelike', search: 'Balatro', sort: 'hoursPlayedDesc', limit: 5 },
      { userId: userAId, mode: 'LIBRARY' }
    );

    expect(result.source).toBe('USER_PERSONAL_LIBRARY');
    const entries = result.entries as Array<Record<string, any>>;
    expect(entries.length).toBe(1);
    expect(entries[0].entryId).toBe(userAEntryId);
    expect(entries[0].entryId).not.toBe(userBEntryId);
    expect(entries[0].hoursPlayed).toBe(19);
  });

  it('7. Ferramenta getUserPreferences retorna preferências reais do usuário autenticado', async () => {
    const result = await gameAgent.getToolsRegistry().executeReadTool(
      'getUserPreferences',
      {},
      { userId: userAId, mode: 'COMPANION' }
    );

    expect(result.source).toBe('USER_PREFERENCES');
    expect(result.preferredPlatforms).toEqual(['PC', 'Steam Deck']);
    expect(result.preferredGenres).toEqual(['RPG', 'Roguelike']);
    expect(result.language).toBe('pt-BR');
  });

  it('8. Ferramenta getJourneyContext reutiliza journeysService.getJourneyContext para jornada do usuário', async () => {
    const result = await gameAgent.getToolsRegistry().executeReadTool(
      'getJourneyContext',
      { journeyId: userAJourneyId },
      { userId: userAId, mode: 'COMPANION' }
    );

    expect(result.source).toBe('GAMEPLAY_JOURNEY_CONTEXT');
    expect((result.journey as any).name).toBe('Run Deck Flush');
    expect((result.journey as any).currentArea).toBe('Ante 6');
    expect((result.recentProgress as any[])[0].questName).toBe('Boss Blind The Wall');
  });

  it('9. Ferramenta getGameBuilds retorna atributos e equipamentos flexíveis para diferentes mecânicas de jogos', async () => {
    const result = await gameAgent.getToolsRegistry().executeReadTool(
      'getGameBuilds',
      { journeyId: userAJourneyId },
      { userId: userAId, mode: 'COMPANION' }
    );

    expect(result.source).toBe('GAME_BUILDS');
    expect(result.totalBuilds).toBe(1);
    const build = (result.builds as any[])[0];
    expect(build.name).toBe('Sinergia de Coringas Multiplicadores');
    expect(build.attributes.MainHandLevel).toBe('Flush Nível 11');
    expect(build.equipment.joker1).toBe('Blueprint');
    expect(Array.isArray(build.attributeEntries)).toBe(true);
    expect(Array.isArray(build.equipmentEntries)).toBe(true);
  });

  it('10. Bloqueio de acesso entre usuários (IDOR) em leitura e proposta de escrita', async () => {
    await expect(
      gameAgent.getToolsRegistry().executeReadTool(
        'getJourneyContext',
        { journeyId: userBJourneyId },
        { userId: userAId, mode: 'COMPANION' }
      )
    ).rejects.toMatchObject({ statusCode: 403 });

    await expect(
      gameAgent.getToolsRegistry().executeReadTool(
        'getGameBuilds',
        { journeyId: userBJourneyId },
        { userId: userAId, mode: 'COMPANION' }
      )
    ).rejects.toMatchObject({ statusCode: 403 });

    await expect(
      gameAgent.getToolsRegistry().prepareWriteProposal(
        'updateGameProgress',
        { journeyId: userBJourneyId, areaName: 'Hack', description: 'Tentativa indevida' },
        { userId: userAId, mode: 'COMPANION' }
      )
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('11. Adição de jogo à biblioteca só ocorre após confirmação explícita do usuário', async () => {
    mockProvider.handler = async (params) => {
      const proposalCall = await params.onToolCall!({
        id: 'prop-add-1',
        name: 'addGameToLibrary',
        args: { gameId: gameCatalogOnlyId, status: 'WISHLIST' },
      });

      expect(proposalCall.trace.status).toBe('PENDING_CONFIRMATION');
      expect(proposalCall.response.status).toBe('PENDING_CONFIRMATION');

      return {
        text: 'Preparei a adição de Hades II Catalog Candidate à sua Lista de Desejos. Confirme abaixo.',
        model: 'gemini-4-hydrogen',
        toolExecutions: [proposalCall.trace],
      };
    };

    const chatRes = await request(app)
      .post('/api/agent/chat')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        conversationId: conversationWithToolsId,
        mode: 'LIBRARY',
        message: 'Adicione Hades II Catalog Candidate na minha wishlist',
      });

    expect(chatRes.status).toBe(200);
    expect(chatRes.body.pendingActions.length).toBe(1);
    const proposal = chatRes.body.pendingActions[0];
    expect(proposal.status).toBe('PENDING');
    expect(proposal.toolName).toBe('addGameToLibrary');

    // Before confirmation: MUST NOT exist in user library!
    const beforeDb = await prisma.userGame.findUnique({
      where: { userId_gameId: { userId: userAId, gameId: gameCatalogOnlyId } },
    });
    expect(beforeDb).toBeNull();

    // User A confirms explicitly
    const confirmRes = await request(app)
      .post(`/api/agent/actions/${proposal.id}/confirm`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.action.status).toBe('EXECUTED');
    expect(confirmRes.body.followUpMessage.content).toContain('Ação confirmada e concluída');

    const afterDb = await prisma.userGame.findUnique({
      where: { userId_gameId: { userId: userAId, gameId: gameCatalogOnlyId } },
    });
    expect(afterDb).not.toBeNull();
    expect(afterDb!.status).toBe('WISHLIST');
  });

  it('12. Cancelamento de proposta marca CANCELLED e não executa alteração no banco', async () => {
    mockProvider.handler = async (params) => {
      const proposalCall = await params.onToolCall!({
        id: 'prop-cancel-1',
        name: 'addGameToLibrary',
        args: { gameId: gameForCancelId, status: 'BACKLOG' },
      });

      return {
        text: 'Confirme se deseja adicionar Hollow Knight Silksong Candidate ao seu backlog.',
        model: 'gemini-4-hydrogen',
        toolExecutions: [proposalCall.trace],
      };
    };

    const chatRes = await request(app)
      .post('/api/agent/chat')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        conversationId: conversationWithToolsId,
        mode: 'LIBRARY',
        message: 'Coloque Silksong no backlog',
      });

    const proposalId = chatRes.body.pendingActions[0].id;

    const cancelRes = await request(app)
      .post(`/api/agent/actions/${proposalId}/cancel`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.action.status).toBe('CANCELLED');
    expect(cancelRes.body.followUpMessage.content).toContain('Ação cancelada pelo usuário');

    const dbEntry = await prisma.userGame.findUnique({
      where: { userId_gameId: { userId: userAId, gameId: gameForCancelId } },
    });
    expect(dbEntry).toBeNull();
  });

  it('13. Registro de progresso na jornada só grava ProgressLog após confirmação explícita', async () => {
    mockProvider.handler = async (params) => {
      const proposalCall = await params.onToolCall!({
        id: 'prop-prog-1',
        name: 'updateGameProgress',
        args: {
          journeyId: userAJourneyId,
          areaName: 'Ante 7',
          questName: 'Blind Violet Vessel',
          description: 'Alcancei 500k fichas com Blueprint duplicando Bloodstone.',
          completionPercent: 85,
        },
      });

      expect(proposalCall.trace.status).toBe('PENDING_CONFIRMATION');
      return {
        text: 'Preparei o marco de progresso da Ante 7 (85%). Clique em Confirmar para salvar.',
        model: 'gemini-4-hydrogen',
        toolExecutions: [proposalCall.trace],
      };
    };

    const chatRes = await request(app)
      .post('/api/agent/chat')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        conversationId: conversationWithToolsId,
        mode: 'COMPANION',
        gameId: gameInLibraryId,
        journeyId: userAJourneyId,
        message: 'Registre que passei da Blind Violet Vessel na Ante 7 com 85%',
      });

    expect(chatRes.status).toBe(200);
    const proposal = chatRes.body.pendingActions[0];
    expect(proposal.toolName).toBe('updateGameProgress');
    expect(proposal.status).toBe('PENDING');

    const countBefore = await prisma.progressLog.count({
      where: { journeyId: userAJourneyId },
    });
    expect(countBefore).toBe(1);

    const confirmRes = await request(app)
      .post(`/api/agent/actions/${proposal.id}/confirm`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.action.status).toBe('EXECUTED');

    const countAfter = await prisma.progressLog.count({
      where: { journeyId: userAJourneyId },
    });
    expect(countAfter).toBe(2);

    const latestLog = await prisma.progressLog.findFirst({
      where: { journeyId: userAJourneyId, areaName: 'Ante 7' },
    });
    expect(latestLog).not.toBeNull();
    expect(latestLog!.completionPercent).toBe(85);
  });

  it('14. Outro usuário não pode confirmar ou cancelar proposta pertencente ao Usuário A (403 FORBIDDEN)', async () => {
    mockProvider.handler = async (params) => {
      const proposalCall = await params.onToolCall!({
        id: 'prop-idor-1',
        name: 'addGameToLibrary',
        args: { gameId: gameForCancelId, status: 'WISHLIST' },
      });
      return {
        text: 'Confirme para adicionar à wishlist.',
        model: 'gemini-4-hydrogen',
        toolExecutions: [proposalCall.trace],
      };
    };

    const chatRes = await request(app)
      .post('/api/agent/chat')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        conversationId: conversationWithToolsId,
        mode: 'LIBRARY',
        message: 'Proponha Silksong na wishlist',
      });

    const proposalId = chatRes.body.pendingActions[0].id;

    const confirmByB = await request(app)
      .post(`/api/agent/actions/${proposalId}/confirm`)
      .set('Authorization', `Bearer ${userBToken}`);
    expect(confirmByB.status).toBe(403);
    expect(confirmByB.body.code).toBe('FORBIDDEN');

    const cancelByB = await request(app)
      .post(`/api/agent/actions/${proposalId}/cancel`)
      .set('Authorization', `Bearer ${userBToken}`);
    expect(cancelByB.status).toBe(403);
    expect(cancelByB.body.code).toBe('FORBIDDEN');

    const stillPending = await prisma.agentActionProposal.findUnique({
      where: { id: proposalId },
    });
    expect(stillPending!.status).toBe('PENDING');
  });

  it('15. Proposta expirada é rejeitada com 410 ACTION_EXPIRED e atualizada para EXPIRED', async () => {
    const expiredProposal = await prisma.agentActionProposal.create({
      data: {
        userId: userAId,
        sessionId: conversationWithToolsId,
        toolName: 'addGameToLibrary',
        validatedArgs: { gameId: gameForCancelId, status: 'BACKLOG' },
        argsHash: 'expired-hash',
        summary: 'Proposta expirada de teste',
        preview: {},
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    const res = await request(app)
      .post(`/api/agent/actions/${expiredProposal.id}/confirm`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(410);
    expect(res.body.code).toBe('ACTION_EXPIRED');

    const updated = await prisma.agentActionProposal.findUnique({
      where: { id: expiredProposal.id },
    });
    expect(updated!.status).toBe('EXPIRED');
  });

  it('16. Impedimento de execução duplicada (sequencial, concorrente e trava argsHash)', async () => {
    mockProvider.handler = async (params) => {
      const proposalCall = await params.onToolCall!({
        id: 'prop-dup-1',
        name: 'addGameToLibrary',
        args: { gameId: gameForDupId, status: 'BACKLOG' },
      });
      return {
        text: 'Confirme para adicionar Disco Elysium.',
        model: 'gemini-4-hydrogen',
        toolExecutions: [proposalCall.trace],
      };
    };

    const chatRes = await request(app)
      .post('/api/agent/chat')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        conversationId: conversationWithToolsId,
        mode: 'LIBRARY',
        message: 'Adicione Disco Elysium no backlog',
      });

    const proposalId = chatRes.body.pendingActions[0].id;

    // Concurrent confirmations -> atomic DB updateMany guarantees ONLY 1 succeeds
    const [res1, res2] = await Promise.all([
      request(app)
        .post(`/api/agent/actions/${proposalId}/confirm`)
        .set('Authorization', `Bearer ${userAToken}`),
      request(app)
        .post(`/api/agent/actions/${proposalId}/confirm`)
        .set('Authorization', `Bearer ${userAToken}`),
    ]);

    const statuses = [res1.status, res2.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409]);

    // Subsequent sequential confirm -> 409 ACTION_ALREADY_EXECUTED
    const res3 = await request(app)
      .post(`/api/agent/actions/${proposalId}/confirm`)
      .set('Authorization', `Bearer ${userAToken}`);
    expect(res3.status).toBe(409);
    expect(res3.body.code).toBe('ACTION_ALREADY_EXECUTED');

    // Integrity tamper test: argsHash mismatch blocks execution
    await expect(
      gameAgent.getToolsRegistry().executeConfirmedWriteTool(
        'addGameToLibrary',
        { gameId: gameForDupId, status: 'COMPLETED' },
        'tampered-hash-mismatch',
        { userId: userAId, mode: 'LIBRARY' }
      )
    ).rejects.toMatchObject({ statusCode: 409, code: 'ACTION_INTEGRITY_MISMATCH' });
  });

  it('17. Tratamento de falhas de ferramentas sem derrubar o servidor ou vazar detalhes internos', async () => {
    const failingToolRegistry = new ToolsRegistry([
      {
        name: 'getUserLibrary',
        description: 'Simula falha temporária',
        accessType: 'READ',
        allowedModes: ['LIBRARY', 'COMPANION'],
        requiresOwnershipCheck: true,
        schema: defaultToolsRegistry.getTool('getUserLibrary')!.schema,
        declaration: defaultToolsRegistry.getTool('getUserLibrary')!.declaration,
        execute: async () => {
          throw createToolError('Serviço de biblioteca temporariamente indisponível.', 503, 'LIB_DOWN');
        },
      },
    ]);

    gameAgent.setToolsRegistry(failingToolRegistry);
    try {
      mockProvider.handler = async (params) => {
        const failedCall = await params.onToolCall!({
          id: 'fail-call',
          name: 'getUserLibrary',
          args: {},
        });
        expect(failedCall.trace.status).toBe('FAILED');
        expect(failedCall.trace.errorCode).toBe('LIB_DOWN');
        expect(failedCall.response.status).toBe('error');

        return {
          text: 'Não consegui consultar sua biblioteca neste instante, mas posso ajudar com orientações gerais.',
          model: 'gemini-4-hydrogen',
          toolExecutions: [failedCall.trace],
        };
      };

      const res = await request(app)
        .post('/api/agent/chat')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ mode: 'LIBRARY', message: 'Liste minha biblioteca mesmo com falha' });

      expect(res.status).toBe(200);
      expect(res.body.toolsUsed[0].status).toBe('FAILED');
      expect(res.body.toolsUsed[0].errorCode).toBe('LIB_DOWN');
    } finally {
      const restored = new ToolsRegistry([
        createSearchGamesTool(mockGamesService),
        createSearchGameKnowledgeTool(),
        createGetUserLibraryTool(),
        createGetUserPreferencesTool(),
        createGetJourneyContextTool(),
        createGetGameBuildsTool(),
        createAddGameToLibraryTool(),
        createUpdateGameProgressTool(),
      ]);
      gameAgent.setToolsRegistry(restored);
    }
  });

  it('18. Limite de chamadas de ferramentas por interação é imposto pelo GeminiProvider', async () => {
    const gemini = new GeminiProvider({ apiKey: 'test-key-only', model: 'gemini-4-hydrogen' });
    let round = 0;

    (gemini as any).client = {
      models: {
        generateContent: async () => {
          round++;
          if (round === 1) {
            // Model emits 3 tool calls in one turn while maxToolCalls is 2
            return {
              functionCalls: [
                { id: 'c1', name: 'getUserPreferences', args: {} },
                { id: 'c2', name: 'getUserLibrary', args: { page: 1 } },
                { id: 'c3', name: 'getUserLibrary', args: { page: 2 } },
              ],
              candidates: [
                {
                  content: {
                    role: 'model',
                    parts: [
                      { functionCall: { id: 'c1', name: 'getUserPreferences', args: {} } },
                      { functionCall: { id: 'c2', name: 'getUserLibrary', args: { page: 1 } } },
                      { functionCall: { id: 'c3', name: 'getUserLibrary', args: { page: 2 } } },
                    ],
                  },
                },
              ],
              usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 20, totalTokenCount: 70 },
            };
          }
          return {
            text: 'Resposta concluída respeitando o limite de chamadas.',
            candidates: [{ finishReason: 'STOP' }],
            usageMetadata: { promptTokenCount: 60, candidatesTokenCount: 25, totalTokenCount: 85 },
          };
        },
      },
    };

    const result = await gemini.generateReply({
      systemInstruction: 'sys',
      history: [],
      userMessage: 'Consulte tudo',
      maxToolCalls: 2,
      maxToolRounds: 3,
      tools: defaultToolsRegistry.getFunctionDeclarations('LIBRARY'),
      onToolCall: async (call) => ({
        response: { status: 'success', data: {} },
        trace: { name: call.name, accessType: 'READ', status: 'EXECUTED', durationMs: 2 },
      }),
    });

    expect(result.text).toContain('respeitando o limite');
    expect(result.toolExecutions?.length).toBe(3);
    expect(result.toolExecutions?.[2].status).toBe('REJECTED');
    expect(result.toolExecutions?.[2].errorCode).toBe('TOOL_CALL_LIMIT_EXCEEDED');
  });

  it('19. Prevenção de loops infinitos bloqueia chamadas idênticas repetidas e preserva thoughtSignature', async () => {
    const gemini = new GeminiProvider({ apiKey: 'test-key-only', model: 'gemini-4-hydrogen' });
    const capturedContents: any[] = [];
    let callIdx = 0;

    (gemini as any).client = {
      models: {
        generateContent: async ({ contents }: any) => {
          capturedContents.push(JSON.parse(JSON.stringify(contents)));
          callIdx++;
          if (callIdx <= 2) {
            return {
              functionCalls: [{ id: `loop-${callIdx}`, name: 'getUserPreferences', args: {} }],
              candidates: [
                {
                  content: {
                    role: 'model',
                    parts: [
                      {
                        thoughtSignature: `sig-round-${callIdx}`,
                        functionCall: { id: `loop-${callIdx}`, name: 'getUserPreferences', args: {} },
                      },
                    ],
                  },
                },
              ],
            };
          }
          return {
            text: 'Loop interrompido e resposta formulada.',
            candidates: [{ finishReason: 'STOP' }],
          };
        },
      },
    };

    const result = await gemini.generateReply({
      systemInstruction: 'sys',
      history: [],
      userMessage: 'Teste de loop',
      maxToolCalls: 6,
      maxToolRounds: 4,
      tools: defaultToolsRegistry.getFunctionDeclarations('LIBRARY'),
      onToolCall: async (call) => ({
        response: { status: 'success', data: { language: 'pt-BR' } },
        trace: { name: call.name, accessType: 'READ', status: 'EXECUTED', durationMs: 1 },
      }),
    });

    expect(result.text).toContain('Loop interrompido');
    expect(result.toolExecutions?.[0].status).toBe('EXECUTED');
    expect(result.toolExecutions?.[1].status).toBe('REJECTED');
    expect(result.toolExecutions?.[1].errorCode).toBe('TOOL_LOOP_PREVENTED');

    // Confirm thoughtSignature from round 1 candidate content was preserved in round 2 contents
    const round2ModelContent = capturedContents[1].find((c: any) => c.role === 'model');
    expect(round2ModelContent.parts[0].thoughtSignature).toBe('sig-round-1');
  });

  it('20. Persistência do histórico após uso de ferramentas e propostas na conversa', async () => {
    const res = await request(app)
      .get(`/api/agent/conversations/${conversationWithToolsId}`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    const detail = res.body.data;
    expect(detail.id).toBe(conversationWithToolsId);
    expect(Array.isArray(detail.messages)).toBe(true);
    expect(detail.messages.some((m: any) => m.metadata?.groundedInRealData === true)).toBe(true);
    expect(Array.isArray(detail.actionProposals)).toBe(true);
    expect(detail.actionProposals.length).toBeGreaterThanOrEqual(4);
    expect(detail.actionProposals.some((p: any) => p.status === 'EXECUTED')).toBe(true);
    expect(detail.actionProposals.some((p: any) => p.status === 'CANCELLED')).toBe(true);
  });

  it('21. Continuidade de conversa funciona normalmente após execução e cancelamento de ferramentas', async () => {
    const res = await request(app)
      .post('/api/agent/chat')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        conversationId: conversationWithToolsId,
        mode: 'COMPANION',
        message: 'Agora o que devo priorizar na Ante 8?',
      });

    expect(res.status).toBe(200);
    expect(res.body.conversationId).toBe(conversationWithToolsId);
    expect(mockProvider.calls.length).toBe(1);
    // History includes earlier assistant turns + confirmation follow-up messages
    expect(mockProvider.calls[0].history.length).toBeGreaterThanOrEqual(4);
  });

  it('22. Contrato da API e segurança frontend (zero GEMINI_API_KEY ou @google/genai em src/)', async () => {
    const res = await request(app)
      .post('/api/agent/chat')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        conversationId: conversationWithToolsId,
        mode: 'LIBRARY',
        message: 'Resumo rápido',
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('groundedInRealData');
    expect(res.body).toHaveProperty('reply');
    expect(res.body).toHaveProperty('conversation');

    // Static check that frontend src/ never imports @google/genai or references GEMINI_API_KEY
    const srcRoot = path.resolve(process.cwd(), 'src');
    const collectFiles = (dir: string): string[] => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files: string[] = [];
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) files.push(...collectFiles(full));
        else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
      }
      return files;
    };

    const frontendFiles = collectFiles(srcRoot);
    for (const filePath of frontendFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).not.toContain('GEMINI_API_KEY');
      expect(content).not.toContain('@google/genai');
    }
  });

  it('23. Documentação OpenAPI 3.0.3 contempla endpoints de confirmação/cancelamento e schemas de ferramentas', async () => {
    const res = await request(app).get('/api/docs.json');
    expect(res.status).toBe(200);
    const doc = res.body;

    expect(doc.paths['/api/agent/actions/{id}/confirm']).toBeDefined();
    expect(doc.paths['/api/agent/actions/{id}/confirm'].post).toBeDefined();
    expect(doc.paths['/api/agent/actions/{id}/cancel']).toBeDefined();
    expect(doc.paths['/api/agent/actions/{id}/cancel'].post).toBeDefined();

    expect(doc.components.schemas.AgentActionProposal).toBeDefined();
    expect(doc.components.schemas.AgentActionDecisionResponse).toBeDefined();
    expect(doc.components.schemas.AgentToolTrace).toBeDefined();
  });

  it('24. Isolamento do banco testing e índice parcial único de idempotência no PostgreSQL estão ativos', async () => {
    const isolation = assertDatabaseIsolation();
    expect(isolation.safe).toBe(true);
    expect(isolation.testEndpoint).toBe('ep-mute-frost-b6xo7qjs');
    expect(isolation.testEndpoint).not.toBe(isolation.prodEndpoint);

    const indexCheck = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'companion_messages'
        AND indexname = 'companion_messages_sessionId_role_clientRequestId_key'
    `;
    expect(indexCheck.length).toBe(1);
  });
});
