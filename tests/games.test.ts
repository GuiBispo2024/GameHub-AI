import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app';
import { prisma } from '../server/db/prisma';
import { TwitchAuthService } from '../server/modules/games/providers/twitch-auth.service';
import { IgdbCatalogProvider } from '../server/modules/games/providers/igdb.provider';
import { GamesRepository } from '../server/modules/games/games.repository';
import { GamesService } from '../server/modules/games/games.service';
import { RawIgdbGame, NormalizedGame } from '../server/modules/games/games.types';

const app = createApp();

describe('GameHub AI — Catálogo de Jogos com IGDB (Fase 2, Tarefa 4)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    TwitchAuthService.clearCache();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. Twitch OAuth 2.0 Client Credentials Flow
  // =========================================================================
  describe('1. Twitch OAuth 2.0 Client Credentials Flow', () => {
    it('1.1 Deve obter access token com sucesso e armazenar em cache', async () => {
      let fetchCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('id.twitch.tv/oauth2/token')) {
          fetchCount++;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              access_token: 'mock_access_token_123',
              expires_in: 3600,
              token_type: 'bearer',
            }),
          };
        }
        return { ok: true, status: 200, json: async () => [] };
      });

      const token1 = await TwitchAuthService.getAccessToken();
      expect(token1).toBe('mock_access_token_123');
      expect(fetchCount).toBe(1);

      // Second call must reuse in-memory cache without hitting Twitch OAuth again
      const token2 = await TwitchAuthService.getAccessToken();
      expect(token2).toBe('mock_access_token_123');
      expect(fetchCount).toBe(1);
    });

    it('1.2 Deve compartilhar Promise em chamadas concorrentes simultâneas', async () => {
      let fetchCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('id.twitch.tv/oauth2/token')) {
          fetchCount++;
          // Small artificial delay to verify concurrency mutex
          await new Promise((resolve) => setTimeout(resolve, 50));
          return {
            ok: true,
            status: 200,
            json: async () => ({
              access_token: 'concurrent_token_456',
              expires_in: 3600,
              token_type: 'bearer',
            }),
          };
        }
        return { ok: true, status: 200, json: async () => [] };
      });

      const [t1, t2, t3] = await Promise.all([
        TwitchAuthService.getAccessToken(),
        TwitchAuthService.getAccessToken(),
        TwitchAuthService.getAccessToken(),
      ]);

      expect(t1).toBe('concurrent_token_456');
      expect(t2).toBe('concurrent_token_456');
      expect(t3).toBe('concurrent_token_456');
      expect(fetchCount).toBe(1);
    });

    it('1.3 Deve renovar o token quando o cache for limpo', async () => {
      let currentToken = 'token_version_1';
      globalThis.fetch = vi.fn().mockImplementation(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: currentToken,
          expires_in: 3600,
          token_type: 'bearer',
        }),
      }));

      const t1 = await TwitchAuthService.getAccessToken();
      expect(t1).toBe('token_version_1');

      TwitchAuthService.clearCache();
      currentToken = 'token_version_2';

      const t2 = await TwitchAuthService.getAccessToken();
      expect(t2).toBe('token_version_2');
    });
  });

  // =========================================================================
  // 2. IgdbCatalogProvider & Normalization & Query Sanitation
  // =========================================================================
  describe('2. IgdbCatalogProvider & Normalização de Dados', () => {
    it('2.1 Deve construir URLs de imagem válidas da CDN oficial da IGDB', () => {
      const coverUrl = IgdbCatalogProvider.buildImageUrl('co4jni', 'cover_big');
      expect(coverUrl).toBe('https://images.igdb.com/igdb/image/upload/t_cover_big/co4jni.jpg');

      const backdropUrl = IgdbCatalogProvider.buildImageUrl('sc73e7', '1080p');
      expect(backdropUrl).toBe('https://images.igdb.com/igdb/image/upload/t_1080p/sc73e7.jpg');

      expect(IgdbCatalogProvider.buildImageUrl('')).toBeNull();
      expect(IgdbCatalogProvider.buildImageUrl(null)).toBeNull();
      expect(IgdbCatalogProvider.buildImageUrl(undefined)).toBeNull();
      expect(IgdbCatalogProvider.buildImageUrl('   ')).toBeNull();
    });

    it('2.2 Deve normalizar dados brutos da IGDB para o modelo NormalizedGame', () => {
      const rawSample: RawIgdbGame = {
        id: 119133,
        name: 'Elden Ring',
        slug: 'elden-ring',
        summary: 'Action RPG in the Lands Between',
        storyline: 'Detailed lore by Miyazaki and George R. R. Martin',
        first_release_date: 1645747200, // 2022-02-25
        aggregated_rating: 96.4,
        cover: { id: 1, image_id: 'co4jni' },
        screenshots: [{ id: 10, image_id: 'sc73e7' }],
        genres: [
          { id: 12, name: 'Role-playing (RPG)' },
          { id: 31, name: 'Adventure' },
        ],
        platforms: [
          { id: 6, name: 'PC (Microsoft Windows)' },
          { id: 167, name: 'PlayStation 5' },
        ],
        involved_companies: [
          {
            id: 100,
            developer: true,
            publisher: false,
            company: { id: 1000, name: 'FromSoftware' },
          },
          {
            id: 200,
            developer: false,
            publisher: true,
            company: { id: 2000, name: 'Bandai Namco' },
          },
        ],
      };

      const normalized = IgdbCatalogProvider.normalizeGame(rawSample);

      expect(normalized.igdbId).toBe(119133);
      expect(normalized.title).toBe('Elden Ring');
      expect(normalized.slug).toBe('elden-ring');
      expect(normalized.summary).toBe('Action RPG in the Lands Between');
      expect(normalized.storyline).toBe('Detailed lore by Miyazaki and George R. R. Martin');
      expect(normalized.releaseDate).toBe('2022-02-25');
      expect(normalized.rating).toBe(96.4);
      expect(normalized.coverUrl).toBe('https://images.igdb.com/igdb/image/upload/t_cover_big/co4jni.jpg');
      expect(normalized.backdropUrl).toBe('https://images.igdb.com/igdb/image/upload/t_1080p/sc73e7.jpg');
      expect(normalized.genres).toEqual(['Role-playing (RPG)', 'Adventure']);
      expect(normalized.platforms).toEqual(['PC (Microsoft Windows)', 'PlayStation 5']);
      expect(normalized.developer).toBe('FromSoftware');
      expect(normalized.publisher).toBe('Bandai Namco');
    });

    it('2.3 Deve lidar com campos opcionais ou nulos na normalização sem quebrar', () => {
      const minimalRaw: RawIgdbGame = {
        id: 99999,
        name: 'Indie Game Without Metadata',
      };

      const normalized = IgdbCatalogProvider.normalizeGame(minimalRaw);

      expect(normalized.igdbId).toBe(99999);
      expect(normalized.title).toBe('Indie Game Without Metadata');
      expect(normalized.summary).toBeNull();
      expect(normalized.coverUrl).toBeNull();
      expect(normalized.rating).toBeNull();
      expect(normalized.releaseDate).toBeNull();
      expect(normalized.genres).toEqual([]);
      expect(normalized.platforms).toEqual([]);
      expect(normalized.developer).toBeNull();
    });

    it('2.4 Deve sanitizar aspas e ponto-e-vírgula para proteger sintaxe APICalypse', async () => {
      const provider = new IgdbCatalogProvider();
      let capturedBody = '';

      globalThis.fetch = vi.fn().mockImplementation(async (url: string, init: any) => {
        if (url.includes('id.twitch.tv')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ access_token: 'dummy', expires_in: 3600 }),
          };
        }
        capturedBody = init.body;
        return {
          ok: true,
          status: 200,
          json: async () => [],
        };
      });

      await provider.searchGames({
        query: 'Zelda"; drop tables; "malicious',
      });

      expect(capturedBody).not.toContain(';"');
      expect(capturedBody).toContain('search "Zelda drop tables malicious"');
    });

    it('2.5 Deve calcular hasNextPage quando IGDB retorna mais resultados que o limite', async () => {
      const provider = new IgdbCatalogProvider();
      const mockRawGames: RawIgdbGame[] = Array.from({ length: 21 }, (_, i) => ({
        id: 1000 + i,
        name: `Game ${i}`,
      }));

      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ access_token: 'dummy', expires_in: 3600 }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => mockRawGames,
        };
      });

      const result = await provider.searchGames({ query: 'Test', limit: 20, page: 1 });
      expect(result.data.length).toBe(20);
      expect(result.pagination.hasNextPage).toBe(true);
    });

    it('2.6 Deve recuperar-se de 401 Unauthorized renovando token Twitch', async () => {
      const provider = new IgdbCatalogProvider();
      let callCount = 0;

      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ access_token: 'fresh_token_after_401', expires_in: 3600 }),
          };
        }

        callCount++;
        if (callCount === 1) {
          return {
            ok: false,
            status: 401,
            text: async () => 'Authorization failure',
          };
        }

        return {
          ok: true,
          status: 200,
          json: async () => [{ id: 101, name: 'Recovered Game' }],
        };
      });

      const result = await provider.searchGames({ query: 'Recover' });
      expect(result.data.length).toBe(1);
      expect(result.data[0].title).toBe('Recovered Game');
      expect(callCount).toBe(2);
    });
  });

  // =========================================================================
  // 3. PostgreSQL Caching Layer (Testing Branch Neon)
  // =========================================================================
  describe('3. Cache no Neon PostgreSQL e Revalidação', () => {
    const testIgdbId = 880001;
    const testGame: NormalizedGame = {
      igdbId: testIgdbId,
      title: 'Neon Cache Test Game',
      slug: `neon-cache-test-${Date.now()}`,
      summary: 'Cache testing game persisted in Neon PostgreSQL',
      coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/test.jpg',
      rating: 88.5,
      releaseDate: '2023-05-15',
      genres: ['RPG', 'Action'],
      platforms: ['PC', 'PS5'],
      developer: 'Neon Studios',
      publisher: 'GameHub Publishing',
    };

    afterEach(async () => {
      try {
        await prisma.game.deleteMany({
          where: { igdbId: { in: [testIgdbId, 880002, 880003] } },
        });
      } catch {}
    });

    it('3.1 Deve salvar o jogo no banco PostgreSQL e retornar com UUID interno', async () => {
      const repo = new GamesRepository();
      const saved = await repo.upsertGame(testGame);

      expect(saved.id).toBeDefined();
      expect(typeof saved.id).toBe('string');
      expect(saved.igdbId).toBe(testIgdbId);
      expect(saved.title).toBe(testGame.title);

      // Verify directly in PostgreSQL testing branch
      const dbRecord = await prisma.game.findUnique({
        where: { igdbId: testIgdbId },
      });
      expect(dbRecord).not.toBeNull();
      expect(dbRecord?.id).toBe(saved.id);
      expect(dbRecord?.name).toBe(testGame.title);
    });

    it('3.2 Deve verificar corretamente a validade do cache através de TTL', () => {
      const now = new Date();
      expect(GamesRepository.isCacheFresh(now, 24)).toBe(true);

      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      expect(GamesRepository.isCacheFresh(twoHoursAgo, 24)).toBe(true);

      const thirtyHoursAgo = new Date(Date.now() - 30 * 60 * 60 * 1000);
      expect(GamesRepository.isCacheFresh(thirtyHoursAgo, 24)).toBe(false);
    });

    it('3.3 Deve evitar chamadas externas ao IGDB quando o jogo já estiver em cache válido', async () => {
      const repo = new GamesRepository();
      await repo.upsertGame(testGame);

      const mockProvider: any = {
        getGameByIgdbId: vi.fn(),
        searchGames: vi.fn(),
      };

      const service = new GamesService(mockProvider, repo);
      const game = await service.getGameByIgdbId(testIgdbId);

      expect(game).not.toBeNull();
      expect(game?.title).toBe(testGame.title);
      expect(mockProvider.getGameByIgdbId).not.toHaveBeenCalled();
    });

    it('3.4 Deve tratar conflitos de slug gerando slug único sufixado com igdbId', async () => {
      const repo = new GamesRepository();
      const sharedSlug = `collision-slug-${Date.now()}`;

      const gameA: NormalizedGame = {
        igdbId: 880002,
        title: 'Game A',
        slug: sharedSlug,
        summary: 'First game',
        coverUrl: null,
        rating: 80,
        releaseDate: null,
        genres: [],
        platforms: [],
      };

      const gameB: NormalizedGame = {
        igdbId: 880003,
        title: 'Game B',
        slug: sharedSlug, // Same slug intentionally
        summary: 'Second game with same slug',
        coverUrl: null,
        rating: 82,
        releaseDate: null,
        genres: [],
        platforms: [],
      };

      const savedA = await repo.upsertGame(gameA);
      const savedB = await repo.upsertGame(gameB);

      expect(savedA.slug).toBe(sharedSlug);
      expect(savedB.slug).toBe(`${sharedSlug}-880003`);
    });
  });

  // =========================================================================
  // 4. REST Endpoints (Supertest)
  // =========================================================================
  describe('4. Endpoints REST da API (/api/games/*)', () => {
    const mockGames: RawIgdbGame[] = [
      {
        id: 7346,
        name: 'The Legend of Zelda: Breath of the Wild',
        slug: 'the-legend-of-zelda-breath-of-the-wild',
        summary: 'Step into a world of discovery, exploration, and adventure',
        first_release_date: 1488508800,
        aggregated_rating: 97.2,
        cover: { id: 1, image_id: 'co3p2d' },
        genres: [{ id: 12, name: 'Adventure' }, { id: 31, name: 'RPG' }],
        platforms: [{ id: 130, name: 'Nintendo Switch' }, { id: 41, name: 'Wii U' }],
        involved_companies: [
          {
            id: 1,
            developer: true,
            publisher: true,
            company: { id: 70, name: 'Nintendo' },
          },
        ],
      },
    ];

    beforeEach(() => {
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ access_token: 'mock_token', expires_in: 3600 }),
          };
        }
        if (url.includes('/genres')) {
          return {
            ok: true,
            status: 200,
            json: async () => [
              { id: 12, name: 'Role-playing (RPG)', slug: 'role-playing-rpg' },
              { id: 31, name: 'Adventure', slug: 'adventure' },
            ],
          };
        }
        if (url.includes('/platforms')) {
          return {
            ok: true,
            status: 200,
            json: async () => [
              { id: 6, name: 'PC (Microsoft Windows)', abbreviation: 'PC', slug: 'win' },
              { id: 167, name: 'PlayStation 5', abbreviation: 'PS5', slug: 'ps5' },
            ],
          };
        }
        // Default /games endpoint
        return {
          ok: true,
          status: 200,
          json: async () => mockGames,
        };
      });
    });

    it('4.1 GET /api/games/search com query válida deve retornar 200 e lista paginada', async () => {
      const res = await request(app).get('/api/games/search?query=Zelda&page=1&limit=10');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].title).toBe('The Legend of Zelda: Breath of the Wild');
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toBe(1);
    });

    it('4.2 GET /api/games/search sem parâmetro query deve retornar 400 VALIDATION_ERROR', async () => {
      const res = await request(app).get('/api/games/search');

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('4.3 GET /api/games/search com limit acima do máximo permitido (50) deve retornar 400', async () => {
      const res = await request(app).get('/api/games/search?query=Zelda&limit=100');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('4.4 GET /api/games/genres deve retornar 200 e lista de gêneros', async () => {
      const res = await request(app).get('/api/games/genres');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data[0].name).toBe('Role-playing (RPG)');
    });

    it('4.5 GET /api/games/platforms deve retornar 200 e lista de plataformas', async () => {
      const res = await request(app).get('/api/games/platforms');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data[0].abbreviation).toBe('PC');
    });

    it('4.6 GET /api/games/igdb/:igdbId com ID numérico válido deve retornar 200', async () => {
      const res = await request(app).get('/api/games/igdb/7346');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.igdbId).toBe(7346);
      expect(res.body.data.title).toBe('The Legend of Zelda: Breath of the Wild');
    });

    it('4.7 GET /api/games/igdb/:igdbId com parâmetro não numérico deve retornar 400', async () => {
      const res = await request(app).get('/api/games/igdb/not-a-number');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('4.8 GET /api/games/igdb/:igdbId inexistente deve retornar 404 GAME_NOT_FOUND', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('id.twitch.tv')) {
          return { ok: true, status: 200, json: async () => ({ access_token: 'tk', expires_in: 3600 }) };
        }
        return { ok: true, status: 200, json: async () => [] };
      });

      const res = await request(app).get('/api/games/igdb/99999999');

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('GAME_NOT_FOUND');
    });

    it('4.9 GET /api/games/:id com UUID inexistente deve retornar 404', async () => {
      const res = await request(app).get('/api/games/00000000-0000-0000-0000-000000000000');

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('GAME_NOT_FOUND');
    });

    it('4.10 GET /api/games/:id com formato não UUID deve retornar 400 VALIDATION_ERROR', async () => {
      const res = await request(app).get('/api/games/invalid-uuid-string');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('4.11 A documentação OpenAPI (/api/docs.json) deve conter os 5 novos endpoints de jogos', async () => {
      const res = await request(app).get('/api/docs.json');

      expect(res.status).toBe(200);
      expect(res.body.paths['/api/games/search']).toBeDefined();
      expect(res.body.paths['/api/games/genres']).toBeDefined();
      expect(res.body.paths['/api/games/platforms']).toBeDefined();
      expect(res.body.paths['/api/games/igdb/{igdbId}']).toBeDefined();
      expect(res.body.paths['/api/games/{id}']).toBeDefined();
    });
  });
});
