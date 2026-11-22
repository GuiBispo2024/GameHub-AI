import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app';
import { prisma } from '../server/db/prisma';
import { assertDatabaseIsolation } from './helpers/testDatabase';

const app = createApp();

describe('GameHub AI — Biblioteca Pessoal de Jogos (Fase 2, Tarefa 5)', () => {
  const ts = Date.now();

  const userA = {
    username: `lib_user_a_${ts}`,
    email: `lib_user_a_${ts}@example.com`,
    password: 'LibPassword123!',
    confirmPassword: 'LibPassword123!',
  };

  const userB = {
    username: `lib_user_b_${ts}`,
    email: `lib_user_b_${ts}@example.com`,
    password: 'LibPassword123!',
    confirmPassword: 'LibPassword123!',
  };

  let userAId = '';
  let userAToken = '';
  let userBId = '';
  let userBToken = '';

  // Controlled game fixtures (persisted on Neon testing branch; zero IGDB network calls)
  let game1Id = '';
  let game2Id = '';
  let game3Id = '';
  let game4Id = '';

  let userAEntry1Id = '';
  let userAEntry2Id = '';
  let userAEntry3Id = '';
  let userBEntry1Id = '';

  beforeAll(async () => {
    // Ensure strict testing branch isolation
    const isolation = assertDatabaseIsolation();
    expect(isolation.safe).toBe(true);
    expect(isolation.testEndpoint).toBe('ep-mute-frost-b6xo7qjs');
    expect(isolation.testEndpoint).not.toBe(isolation.prodEndpoint);

    // Register User A and User B
    const resA = await request(app).post('/api/auth/register').send(userA);
    expect(resA.status).toBe(201);
    userAId = resA.body.user.id;
    userAToken = resA.body.token;

    const resB = await request(app).post('/api/auth/register').send(userB);
    expect(resB.status).toBe(201);
    userBId = resB.body.user.id;
    userBToken = resB.body.token;

    // Seed controlled Game fixtures in testing DB
    const g1 = await prisma.game.create({
      data: {
        igdbId: 990001 + (ts % 10000),
        name: 'Alpha Elden Souls',
        slug: `alpha-elden-souls-${ts}`,
        summary: 'Dark fantasy action RPG fixture',
        genres: ['Role-playing (RPG)', 'Adventure'],
        platforms: ['PC (Microsoft Windows)', 'PlayStation 5'],
        rating: 95,
        developer: 'FromSoftware',
      },
    });
    const g2 = await prisma.game.create({
      data: {
        igdbId: 990002 + (ts % 10000),
        name: 'Beta Cyberpunk Tactics',
        slug: `beta-cyberpunk-tactics-${ts}`,
        summary: 'Sci-fi strategy fixture',
        genres: ['Strategy', 'Shooter'],
        platforms: ['PC (Microsoft Windows)'],
        rating: 88,
        developer: 'CD Projekt',
      },
    });
    const g3 = await prisma.game.create({
      data: {
        igdbId: 990003 + (ts % 10000),
        name: 'Gamma Zelda Odyssey',
        slug: `gamma-zelda-odyssey-${ts}`,
        summary: 'Nintendo platform adventure fixture',
        genres: ['Adventure', 'Platform'],
        platforms: ['Nintendo Switch'],
        rating: 97,
        developer: 'Nintendo',
      },
    });
    const g4 = await prisma.game.create({
      data: {
        igdbId: 990004 + (ts % 10000),
        name: 'Delta Hollow Metroid',
        slug: `delta-hollow-metroid-${ts}`,
        summary: 'Indie metroidvania fixture',
        genres: ['Indie', 'Platform'],
        platforms: ['PC (Microsoft Windows)', 'Nintendo Switch'],
        rating: 92,
        developer: 'Team Cherry',
      },
    });

    game1Id = g1.id;
    game2Id = g2.id;
    game3Id = g3.id;
    game4Id = g4.id;
  });

  afterAll(async () => {
    try {
      const userIds = [userAId, userBId].filter(Boolean);
      const gameIds = [game1Id, game2Id, game3Id, game4Id].filter(Boolean);

      if (userIds.length > 0) {
        await prisma.userGame.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
      if (gameIds.length > 0) {
        await prisma.game.deleteMany({ where: { id: { in: gameIds } } });
      }
    } catch {}
  });

  // =========================================================================
  // 22. Biblioteca vazia inicialmente
  // =========================================================================
  it('22. Deve validar dados e estatísticas coerentes para biblioteca vazia', async () => {
    const listRes = await request(app)
      .get('/api/library')
      .set('Authorization', `Bearer ${userAToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toEqual([]);
    expect(listRes.body.pagination.total).toBe(0);

    const statsRes = await request(app)
      .get('/api/library/stats')
      .set('Authorization', `Bearer ${userAToken}`);

    expect(statsRes.status).toBe(200);
    expect(statsRes.body.data.totalGames).toBe(0);
    expect(statsRes.body.data.completedCount).toBe(0);
    expect(statsRes.body.data.totalHoursPlayed).toBe(0);
    expect(statsRes.body.data.averageRating).toBeNull();
    expect(statsRes.body.data.byStatus).toEqual({
      WISHLIST: 0,
      BACKLOG: 0,
      PLAYING: 0,
      COMPLETED: 0,
      PAUSED: 0,
      DROPPED: 0,
    });
  });

  // =========================================================================
  // 1-4. Inclusão de jogos e validações
  // =========================================================================
  it('4. Deve impedir inclusão na biblioteca sem autenticação (401)', async () => {
    const res = await request(app)
      .post('/api/library')
      .send({ gameId: game1Id, status: 'BACKLOG' });

    expect(res.status).toBe(401);
  });

  it('3. Deve rejeitar gameId inexistente com 404 Not Found', async () => {
    const res = await request(app)
      .post('/api/library')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        gameId: '00000000-0000-4000-8000-000000000000',
        status: 'BACKLOG',
      });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('GAME_NOT_FOUND');
  });

  it('1. Deve adicionar jogo à biblioteca do usuário autenticado (201 Created)', async () => {
    const res = await request(app)
      .post('/api/library')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        userId: userBId, // Tentativa maliciosa de associar a outro usuário deve ser ignorada
        gameId: game1Id,
        status: 'BACKLOG',
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.userId).toBe(userAId);
    expect(res.body.data.gameId).toBe(game1Id);
    expect(res.body.data.status).toBe('BACKLOG');
    expect(res.body.data.game.title).toBe('Alpha Elden Souls');

    userAEntry1Id = res.body.data.id;
  });

  it('2. Deve impedir inclusão duplicada do mesmo jogo pelo mesmo usuário (409 Conflict)', async () => {
    const res = await request(app)
      .post('/api/library')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        gameId: game1Id,
        status: 'PLAYING',
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALREADY_IN_LIBRARY');
  });

  // =========================================================================
  // 5-6. Consulta e Isolamento entre Usuários
  // =========================================================================
  it('5. Deve consultar a própria biblioteca e detalhes via GET /api/library/:id', async () => {
    // Adicionar mais dois jogos para User A e um jogo compartilhado para User B
    const r2 = await request(app)
      .post('/api/library')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ gameId: game2Id, status: 'PLAYING', hoursPlayed: 15, rating: 8 });
    expect(r2.status).toBe(201);
    userAEntry2Id = r2.body.data.id;

    const r3 = await request(app)
      .post('/api/library')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ gameId: game3Id, status: 'COMPLETED', hoursPlayed: 60, rating: 10 });
    expect(r3.status).toBe(201);
    userAEntry3Id = r3.body.data.id;

    const rB = await request(app)
      .post('/api/library')
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ gameId: game1Id, status: 'WISHLIST' });
    expect(rB.status).toBe(201);
    userBEntry1Id = rB.body.data.id;

    // User A consulta própria biblioteca
    const listRes = await request(app)
      .get('/api/library')
      .set('Authorization', `Bearer ${userAToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBe(3);
    expect(listRes.body.data.every((e: any) => e.userId === userAId)).toBe(true);

    // User A consulta detalhe via UUID de UserGame
    const detailRes = await request(app)
      .get(`/api/library/${userAEntry1Id}`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.id).toBe(userAEntry1Id);
    expect(detailRes.body.data.game.title).toBe('Alpha Elden Souls');
  });

  it('6. Deve impedir leitura de entrada da biblioteca de outro usuário (403 Forbidden)', async () => {
    const res = await request(app)
      .get(`/api/library/${userAEntry1Id}`)
      .set('Authorization', `Bearer ${userBToken}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  // =========================================================================
  // 7-12. Atualizações parciais e validações Zod
  // =========================================================================
  it('7. Deve atualizar o status na biblioteca (PATCH /api/library/:id)', async () => {
    const res = await request(app)
      .patch(`/api/library/${userAEntry1Id}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ status: 'PLAYING' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PLAYING');
    expect(res.body.data.startedAt).not.toBeNull();

    // Testar PAUSED e WISHLIST
    const resPaused = await request(app)
      .patch(`/api/library/${userAEntry1Id}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ status: 'PAUSED' });

    expect(resPaused.status).toBe(200);
    expect(resPaused.body.data.status).toBe('PAUSED');
  });

  it('8. Deve atualizar a avaliação pessoal (0 a 10) sem sobrescrever outros campos', async () => {
    const res = await request(app)
      .patch(`/api/library/${userAEntry1Id}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ rating: 9 });

    expect(res.status).toBe(200);
    expect(res.body.data.rating).toBe(9);
    expect(res.body.data.status).toBe('PAUSED'); // Preserved!
  });

  it('9. Deve rejeitar nota fora do intervalo 0-10 ou decimal (400 VALIDATION_ERROR)', async () => {
    const resHigh = await request(app)
      .patch(`/api/library/${userAEntry1Id}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ rating: 11 });
    expect(resHigh.status).toBe(400);
    expect(resHigh.body.code).toBe('VALIDATION_ERROR');

    const resLow = await request(app)
      .patch(`/api/library/${userAEntry1Id}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ rating: -1 });
    expect(resLow.status).toBe(400);

    const resFloat = await request(app)
      .patch(`/api/library/${userAEntry1Id}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ rating: 8.5 });
    expect(resFloat.status).toBe(400);
  });

  it('10. Deve rejeitar horas jogadas negativas (400 VALIDATION_ERROR)', async () => {
    const res = await request(app)
      .patch(`/api/library/${userAEntry1Id}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ hoursPlayed: -5 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('11. Deve atualizar horas jogadas e anotações pessoais', async () => {
    const res = await request(app)
      .patch(`/api/library/${userAEntry1Id}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        hoursPlayed: 32.5,
        notes: 'Derrotei Margit e Godrick no castelo Tempesvéu.',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.hoursPlayed).toBe(32.5);
    expect(res.body.data.notes).toBe('Derrotei Margit e Godrick no castelo Tempesvéu.');
  });

  it('12. Deve impedir alteração direta de userId e gameId no PATCH', async () => {
    const resUserTamper = await request(app)
      .patch(`/api/library/${userAEntry1Id}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ userId: userBId });

    expect(resUserTamper.status).toBe(400);
    expect(resUserTamper.body.code).toBe('VALIDATION_ERROR');

    const resGameTamper = await request(app)
      .patch(`/api/library/${userAEntry1Id}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ gameId: game4Id });

    expect(resGameTamper.status).toBe(400);
    expect(resGameTamper.body.code).toBe('VALIDATION_ERROR');

    // Confirmar no banco que userId e gameId permaneceram íntegros
    const dbRecord = await prisma.userGame.findUnique({ where: { id: userAEntry1Id } });
    expect(dbRecord?.userId).toBe(userAId);
    expect(dbRecord?.gameId).toBe(game1Id);
  });

  // =========================================================================
  // 16-21. Filtros, Ordenação, Paginação e Estatísticas
  // =========================================================================
  it('16. Deve filtrar jogos da biblioteca por status', async () => {
    const res = await request(app)
      .get('/api/library?status=COMPLETED')
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].id).toBe(userAEntry3Id);
  });

  it('17. Deve filtrar jogos da biblioteca por gênero', async () => {
    const res = await request(app)
      .get('/api/library?genre=Strategy')
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].game.title).toBe('Beta Cyberpunk Tactics');
  });

  it('18. Deve filtrar jogos da biblioteca por plataforma', async () => {
    const res = await request(app)
      .get('/api/library?platform=Nintendo Switch')
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].game.title).toBe('Gamma Zelda Odyssey');
  });

  it('19. Deve ordenar jogos por avaliação pessoal (ratingDesc)', async () => {
    const res = await request(app)
      .get('/api/library?sort=ratingDesc')
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    const ratings = res.body.data.map((e: any) => e.rating);
    expect(ratings).toEqual([10, 9, 8]);
  });

  it('20. Deve aplicar paginação corretamente com metadados consistentes', async () => {
    const page1 = await request(app)
      .get('/api/library?page=1&limit=2&sort=titleAsc')
      .set('Authorization', `Bearer ${userAToken}`);

    expect(page1.status).toBe(200);
    expect(page1.body.data.length).toBe(2);
    expect(page1.body.pagination).toEqual({
      page: 1,
      limit: 2,
      total: 3,
      totalPages: 2,
      hasNextPage: true,
      hasPrevPage: false,
    });

    const page2 = await request(app)
      .get('/api/library?page=2&limit=2&sort=titleAsc')
      .set('Authorization', `Bearer ${userAToken}`);

    expect(page2.status).toBe(200);
    expect(page2.body.data.length).toBe(1);
    expect(page2.body.pagination.hasNextPage).toBe(false);
    expect(page2.body.pagination.hasPrevPage).toBe(true);
  });

  it('21. Deve calcular estatísticas reais da biblioteca do usuário autenticado', async () => {
    const res = await request(app)
      .get('/api/library/stats')
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      totalGames: 3,
      completedCount: 1,
      totalHoursPlayed: 107.5, // 32.5 + 15 + 60
      averageRating: 9, // (9 + 8 + 10) / 3 = 9
      ratedGamesCount: 3,
      byStatus: {
        WISHLIST: 0,
        BACKLOG: 0,
        PLAYING: 1,
        COMPLETED: 1,
        PAUSED: 1,
        DROPPED: 0,
      },
    });
  });

  // =========================================================================
  // 13-15. Remoção e Preservação do Catálogo Compartilhado
  // =========================================================================
  it('14. Deve impedir remoção de jogo pertencente à biblioteca de outro usuário (403)', async () => {
    const res = await request(app)
      .delete(`/api/library/${userAEntry1Id}`)
      .set('Authorization', `Bearer ${userBToken}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');

    const stillExists = await prisma.userGame.findUnique({ where: { id: userAEntry1Id } });
    expect(stillExists).not.toBeNull();
  });

  it('13 & 15. Deve remover jogo da própria biblioteca (204) sem excluir o Game compartilhado nem afetar User B', async () => {
    const delRes = await request(app)
      .delete(`/api/library/${userAEntry1Id}`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(delRes.status).toBe(204);

    // Confirmar que UserGame de User A foi removido
    const deletedUserGame = await prisma.userGame.findUnique({ where: { id: userAEntry1Id } });
    expect(deletedUserGame).toBeNull();

    // Confirmar que o Game compartilhado permanece intacto no catálogo PostgreSQL
    const sharedGame = await prisma.game.findUnique({ where: { id: game1Id } });
    expect(sharedGame).not.toBeNull();
    expect(sharedGame?.name).toBe('Alpha Elden Souls');

    // Confirmar que o vínculo de User B para o mesmo Game permanece intacto
    const userBGame = await prisma.userGame.findUnique({ where: { id: userBEntry1Id } });
    expect(userBGame).not.toBeNull();
    expect(userBGame?.status).toBe('WISHLIST');
  });

  // =========================================================================
  // 23-24. OpenAPI & Persistência Real na Branch Testing
  // =========================================================================
  it('23. Deve expor todos os endpoints da biblioteca na documentação OpenAPI (/api/docs.json)', async () => {
    const res = await request(app).get('/api/docs.json');

    expect(res.status).toBe(200);
    expect(res.body.paths['/api/library']).toBeDefined();
    expect(res.body.paths['/api/library'].post).toBeDefined();
    expect(res.body.paths['/api/library'].get).toBeDefined();
    expect(res.body.paths['/api/library/stats']).toBeDefined();
    expect(res.body.paths['/api/library/{id}']).toBeDefined();
    expect(res.body.paths['/api/library/{id}'].get).toBeDefined();
    expect(res.body.paths['/api/library/{id}'].patch).toBeDefined();
    expect(res.body.paths['/api/library/{id}'].delete).toBeDefined();
  });

  it('24. Deve confirmar persistência real de UserGame e notas na branch testing do Neon', async () => {
    const dbEntry = await prisma.userGame.findUnique({
      where: { id: userAEntry3Id },
      include: { game: true },
    });

    expect(dbEntry).not.toBeNull();
    expect(dbEntry?.userId).toBe(userAId);
    expect(dbEntry?.status).toBe('COMPLETED');
    expect(dbEntry?.rating).toBe(10);
    expect(dbEntry?.hoursPlayed).toBe(60);
    expect(dbEntry?.game.name).toBe('Gamma Zelda Odyssey');
  });
});
