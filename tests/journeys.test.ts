import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app';
import { prisma } from '../server/db/prisma';
import { journeysService } from '../server/modules/journeys/journeys.service';
import { assertDatabaseIsolation } from './helpers/testDatabase';

const app = createApp();

describe('GameHub AI — Jornadas de Gameplay, Histórico de Progresso e Builds (Fase 2, Tarefa 6)', () => {
  const ts = Date.now();

  const userA = {
    username: `jrn_user_a_${ts}`,
    email: `jrn_user_a_${ts}@example.com`,
    password: 'JourneyPass123!',
    confirmPassword: 'JourneyPass123!',
  };

  const userB = {
    username: `jrn_user_b_${ts}`,
    email: `jrn_user_b_${ts}@example.com`,
    password: 'JourneyPass123!',
    confirmPassword: 'JourneyPass123!',
  };

  let userAId = '';
  let userAToken = '';
  let userBId = '';
  let userBToken = '';

  let gameId1 = '';
  let gameId2 = '';
  let userAEntry1Id = '';
  let userAEntry2Id = '';
  let userBEntry1Id = '';

  let journey1Id = '';
  let journey2Id = '';
  let journey3Id = '';
  let progress1Id = '';
  let progress2Id = '';
  let build1Id = '';
  let build2Id = '';

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

    const g1 = await prisma.game.create({
      data: {
        igdbId: 880001 + (ts % 10000),
        name: 'Elden Ring Test Edition',
        slug: `elden-ring-test-${ts}`,
        summary: 'Action RPG test fixture',
        genres: ['Role-playing (RPG)'],
        platforms: ['PC (Microsoft Windows)'],
      },
    });
    const g2 = await prisma.game.create({
      data: {
        igdbId: 880002 + (ts % 10000),
        name: 'Hollow Knight Test Edition',
        slug: `hollow-knight-test-${ts}`,
        summary: 'Metroidvania test fixture',
        genres: ['Platform', 'Adventure'],
        platforms: ['PC (Microsoft Windows)', 'Nintendo Switch'],
      },
    });
    gameId1 = g1.id;
    gameId2 = g2.id;

    const libA1 = await request(app)
      .post('/api/library')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ gameId: gameId1, status: 'PLAYING' });
    expect(libA1.status).toBe(201);
    userAEntry1Id = libA1.body.data.id;

    const libA2 = await request(app)
      .post('/api/library')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ gameId: gameId2, status: 'PLAYING' });
    expect(libA2.status).toBe(201);
    userAEntry2Id = libA2.body.data.id;

    const libB1 = await request(app)
      .post('/api/library')
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ gameId: gameId1, status: 'BACKLOG' });
    expect(libB1.status).toBe(201);
    userBEntry1Id = libB1.body.data.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [userAId, userBId].filter(Boolean) } },
    });
    await prisma.game.deleteMany({
      where: { id: { in: [gameId1, gameId2].filter(Boolean) } },
    });
  });

  it('1. Deve bloquear acesso não autenticado às rotas de jornadas, progresso e builds (401)', async () => {
    const r1 = await request(app).get('/api/journeys');
    expect(r1.status).toBe(401);

    const r2 = await request(app).post('/api/journeys').send({
      userGameId: userAEntry1Id,
      name: 'Sem Auth',
    });
    expect(r2.status).toBe(401);

    const r3 = await request(app).patch('/api/progress/00000000-0000-4000-8000-000000000001').send({ description: 'x' });
    expect(r3.status).toBe(401);

    const r4 = await request(app).get('/api/builds/00000000-0000-4000-8000-000000000001');
    expect(r4.status).toBe(401);
  });

  it('2. Deve criar a primeira jornada de um jogo e marcá-la automaticamente como ativa (201)', async () => {
    const res = await request(app)
      .post('/api/journeys')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        userGameId: userAEntry1Id,
        name: '1ª Run - Mago Astral',
        characterName: 'Aurelia',
        characterClass: 'Astrólogo',
        currentLevel: 32,
        currentArea: 'Liurnia dos Lagos',
        currentObjective: 'Explorar a Academia de Raya Lucaria',
        playtimeHours: 14.5,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.name).toBe('1ª Run - Mago Astral');
    expect(res.body.data.characterName).toBe('Aurelia');
    expect(res.body.data.characterClass).toBe('Astrólogo');
    expect(res.body.data.currentLevel).toBe(32);
    expect(res.body.data.currentArea).toBe('Liurnia dos Lagos');
    expect(res.body.data.isActive).toBe(true);
    expect(res.body.data.isCompleted).toBe(false);
    expect(res.body.data.status).toBe('IN_PROGRESS');

    journey1Id = res.body.data.id;
  });

  it('3. Deve impedir criação de jornada em UserGame de outro usuário (403) ou inexistente (404)', async () => {
    const forbiddenRes = await request(app)
      .post('/api/journeys')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        userGameId: userBEntry1Id,
        name: 'Tentativa IDOR',
      });
    expect(forbiddenRes.status).toBe(403);

    const notFoundRes = await request(app)
      .post('/api/journeys')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        userGameId: '00000000-0000-4000-8000-000000000099',
        name: 'Jogo Inexistente',
      });
    expect(notFoundRes.status).toBe(404);
  });

  it('4. Deve criar múltiplas jornadas para o mesmo jogo mantendo apenas 1 ativa', async () => {
    const res2 = await request(app)
      .post('/api/journeys')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        userGameId: userAEntry1Id,
        name: '2ª Run - Samurai Sangramento',
        characterName: 'Kenshin',
        characterClass: 'Samurai',
        currentLevel: 10,
        currentArea: 'Limgrave',
      });

    expect(res2.status).toBe(201);
    expect(res2.body.data.isActive).toBe(false);
    journey2Id = res2.body.data.id;

    const res3 = await request(app)
      .post('/api/journeys')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        userGameId: userAEntry1Id,
        name: '3ª Run - Desafio Nível 1',
      });

    expect(res3.status).toBe(201);
    expect(res3.body.data.isActive).toBe(false);
    journey3Id = res3.body.data.id;

    const activeCount = await prisma.gameplayJourney.count({
      where: { userGameId: userAEntry1Id, isActive: true },
    });
    expect(activeCount).toBe(1);
  });

  it('5. Deve alternar jornada ativa via PATCH /api/journeys/:id/activate desativando a anterior', async () => {
    const activateRes = await request(app)
      .patch(`/api/journeys/${journey2Id}/activate`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(activateRes.status).toBe(200);
    expect(activateRes.body.data.id).toBe(journey2Id);
    expect(activateRes.body.data.isActive).toBe(true);

    const oldJourney = await prisma.gameplayJourney.findUnique({ where: { id: journey1Id } });
    expect(oldJourney?.isActive).toBe(false);
  });

  it('6. Deve garantir exatamente 1 jornada ativa sob chamadas concorrentes de ativação (Promise.all)', async () => {
    const results = await Promise.all([
      request(app).patch(`/api/journeys/${journey1Id}/activate`).set('Authorization', `Bearer ${userAToken}`),
      request(app).patch(`/api/journeys/${journey2Id}/activate`).set('Authorization', `Bearer ${userAToken}`),
      request(app).patch(`/api/journeys/${journey3Id}/activate`).set('Authorization', `Bearer ${userAToken}`),
    ]);

    for (const r of results) {
      expect(r.status).toBe(200);
    }

    const activeJourneys = await prisma.gameplayJourney.findMany({
      where: { userGameId: userAEntry1Id, isActive: true },
    });
    expect(activeJourneys).toHaveLength(1);

    // Re-activate journey1Id for subsequent tests cleanly
    const reAct = await request(app)
      .patch(`/api/journeys/${journey1Id}/activate`)
      .set('Authorization', `Bearer ${userAToken}`);
    expect(reAct.status).toBe(200);
  });

  it('7. Deve listar jornadas com filtro opcional por userGameId e paginação', async () => {
    const listAll = await request(app)
      .get('/api/journeys')
      .set('Authorization', `Bearer ${userAToken}`);
    expect(listAll.status).toBe(200);
    expect(listAll.body.data.length).toBeGreaterThanOrEqual(3);
    expect(listAll.body.pagination.total).toBeGreaterThanOrEqual(3);

    const listFiltered = await request(app)
      .get(`/api/journeys?userGameId=${userAEntry1Id}&page=1&limit=2`)
      .set('Authorization', `Bearer ${userAToken}`);
    expect(listFiltered.status).toBe(200);
    expect(listFiltered.body.data).toHaveLength(2);
    expect(listFiltered.body.pagination.total).toBe(3);
    expect(listFiltered.body.pagination.hasNextPage).toBe(true);
  });

  it('8. Deve consultar detalhes de uma jornada específica via GET /api/journeys/:id', async () => {
    const res = await request(app)
      .get(`/api/journeys/${journey1Id}`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(journey1Id);
    expect(res.body.data.game.title).toBe('Elden Ring Test Edition');
  });

  it('9. Deve atualizar personagem, área, objetivo e estado da jornada, rejeitando campos proibidos', async () => {
    const patchRes = await request(app)
      .patch(`/api/journeys/${journey1Id}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        currentLevel: 78,
        currentArea: 'Platô Altus',
        currentObjective: 'Entrar em Leyndell',
        playtimeHours: 38.5,
        status: 'COMPLETED',
        notes: 'Final da Era das Estrelas concluído.',
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.currentLevel).toBe(78);
    expect(patchRes.body.data.currentArea).toBe('Platô Altus');
    expect(patchRes.body.data.isCompleted).toBe(true);
    expect(patchRes.body.data.status).toBe('COMPLETED');

    const forbiddenFieldRes = await request(app)
      .patch(`/api/journeys/${journey1Id}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        userId: userBId,
      });
    expect(forbiddenFieldRes.status).toBe(400);
  });

  it('10. Deve bloquear leitura, edição, ativação e exclusão de jornada de outro usuário (403)', async () => {
    const getRes = await request(app)
      .get(`/api/journeys/${journey1Id}`)
      .set('Authorization', `Bearer ${userBToken}`);
    expect(getRes.status).toBe(403);

    const patchRes = await request(app)
      .patch(`/api/journeys/${journey1Id}`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ currentLevel: 999 });
    expect(patchRes.status).toBe(403);

    const actRes = await request(app)
      .patch(`/api/journeys/${journey1Id}/activate`)
      .set('Authorization', `Bearer ${userBToken}`);
    expect(actRes.status).toBe(403);

    const delRes = await request(app)
      .delete(`/api/journeys/${journey1Id}`)
      .set('Authorization', `Bearer ${userBToken}`);
    expect(delRes.status).toBe(403);
  });

  it('11. Deve registrar marco de progresso com percentual de conclusão (201)', async () => {
    const res = await request(app)
      .post(`/api/journeys/${journey1Id}/progress`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        areaName: 'Castelo Tempesvéu',
        questName: 'Derrotar Godrick',
        description: 'Primeiro Semideus derrotado com auxílio de magia gravitacional.',
        completionPercent: 25,
        hoursPlayedAtPoint: 12,
        playerLevelAtPoint: 35,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.areaName).toBe('Castelo Tempesvéu');
    expect(res.body.data.questName).toBe('Derrotar Godrick');
    expect(res.body.data.completionPercent).toBe(25);
    progress1Id = res.body.data.id;
  });

  it('12. Deve permitir registrar progresso SEM percentual para jogos sem % de conclusão', async () => {
    // Small delay guarantees distinct timestamp ordering for chronological test
    await new Promise((r) => setTimeout(r, 20));

    const res = await request(app)
      .post(`/api/journeys/${journey1Id}/progress`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        areaName: 'Mansão Cariana',
        description: 'Explorada a área secreta e liberado o acesso às Três Irmãs.',
        completionPercent: null,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.completionPercent).toBeNull();
    expect(res.body.data.questName).toBeNull();
    progress2Id = res.body.data.id;
  });

  it('13. Deve listar histórico de progresso em ordem cronológica crescente', async () => {
    const res = await request(app)
      .get(`/api/journeys/${journey1Id}/progress`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].id).toBe(progress1Id);
    expect(res.body.data[1].id).toBe(progress2Id);
    expect(new Date(res.body.data[0].createdAt).getTime()).toBeLessThanOrEqual(
      new Date(res.body.data[1].createdAt).getTime()
    );
  });

  it('14. Deve editar registro de progresso e bloquear acesso de outro usuário (403)', async () => {
    const forbidden = await request(app)
      .patch(`/api/progress/${progress1Id}`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ description: 'Hack' });
    expect(forbidden.status).toBe(403);

    const updated = await request(app)
      .patch(`/api/progress/${progress1Id}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        completionPercent: 30,
        description: 'Godrick derrotado após ajustar frascos de mana.',
      });
    expect(updated.status).toBe(200);
    expect(updated.body.data.completionPercent).toBe(30);
    expect(updated.body.data.description).toContain('frascos de mana');
  });

  it('15. Deve excluir registro de progresso via DELETE /api/progress/:id', async () => {
    const delForbidden = await request(app)
      .delete(`/api/progress/${progress2Id}`)
      .set('Authorization', `Bearer ${userBToken}`);
    expect(delForbidden.status).toBe(403);

    const delOk = await request(app)
      .delete(`/api/progress/${progress2Id}`)
      .set('Authorization', `Bearer ${userAToken}`);
    expect(delOk.status).toBe(204);

    const remaining = await request(app)
      .get(`/api/journeys/${journey1Id}/progress`)
      .set('Authorization', `Bearer ${userAToken}`);
    expect(remaining.body.data).toHaveLength(1);
  });

  it('16. Deve criar build com JSON flexível de attributes e equipment (201)', async () => {
    const res = await request(app)
      .post(`/api/journeys/${journey1Id}/builds`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        name: 'Mago Lunar Carian',
        playstyle: 'Sorcery Burst',
        description: 'Foco em dano mágico com Lua Cheia e Véu da Lua.',
        attributes: {
          Vigor: 40,
          Mind: 30,
          Intelligence: 68,
          Dexterity: 18,
        },
        equipment: {
          rightHand: 'Cetro Real Carian',
          leftHand: 'Véu da Lua',
          talismans: ['Ícone de Radagon', 'Massa Graven'],
        },
        notes: 'Usar elixir de mana infinita no início contra chefes.',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Mago Lunar Carian');
    expect(res.body.data.attributes.Intelligence).toBe(68);
    expect(res.body.data.equipment.talismans).toEqual(['Ícone de Radagon', 'Massa Graven']);
    build1Id = res.body.data.id;
  });

  it('17. Deve aceitar criação de build para jogos sem classes ou equipamentos (JSON vazio)', async () => {
    const res = await request(app)
      .post(`/api/journeys/${journey1Id}/builds`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        name: 'Setup Amuletos Exploração',
        notes: 'Sem atributos numéricos.',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.attributes).toEqual({});
    expect(res.body.data.equipment).toEqual({});
    build2Id = res.body.data.id;
  });

  it('18. Deve rejeitar payloads JSON arbitrariamente grandes na criação/edição de build (400)', async () => {
    const oversizedAttributes: Record<string, string> = {};
    for (let i = 0; i < 60; i++) {
      oversizedAttributes[`stat_${i}`] = 'x'.repeat(300);
    }

    const res = await request(app)
      .post(`/api/journeys/${journey1Id}/builds`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        name: 'Build Gigante',
        attributes: oversizedAttributes,
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('19. Deve listar, consultar, atualizar, excluir builds e bloquear acesso cross-user (403)', async () => {
    const listRes = await request(app)
      .get(`/api/journeys/${journey1Id}/builds`)
      .set('Authorization', `Bearer ${userAToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(2);

    const getForbidden = await request(app)
      .get(`/api/builds/${build1Id}`)
      .set('Authorization', `Bearer ${userBToken}`);
    expect(getForbidden.status).toBe(403);

    const getOk = await request(app)
      .get(`/api/builds/${build1Id}`)
      .set('Authorization', `Bearer ${userAToken}`);
    expect(getOk.status).toBe(200);
    expect(getOk.body.data.id).toBe(build1Id);

    const patchOk = await request(app)
      .patch(`/api/builds/${build1Id}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        attributes: { Vigor: 45, Intelligence: 75 },
      });
    expect(patchOk.status).toBe(200);
    expect(patchOk.body.data.attributes.Intelligence).toBe(75);

    const delOk = await request(app)
      .delete(`/api/builds/${build2Id}`)
      .set('Authorization', `Bearer ${userAToken}`);
    expect(delOk.status).toBe(204);
  });

  it('20. Deve preparar contexto estruturado para o Game Companion (getJourneyContext) com histórico limitado e validação de propriedade', async () => {
    const ctx = await journeysService.getJourneyContext(userAId, journey1Id, 5);
    expect(ctx.game.title).toBe('Elden Ring Test Edition');
    expect(ctx.journey.id).toBe(journey1Id);
    expect(ctx.builds).toHaveLength(1);
    expect(ctx.recentProgress).toHaveLength(1);
    expect(ctx.totalProgressLogs).toBe(1);

    await expect(journeysService.getJourneyContext(userBId, journey1Id)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('21. Deve bloquear exclusão de UserGame na biblioteca com 409 HAS_DEPENDENT_JOURNEYS enquanto existirem jornadas associadas', async () => {
    const delLibBlocked = await request(app)
      .delete(`/api/library/${userAEntry1Id}`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(delLibBlocked.status).toBe(409);
    expect(delLibBlocked.body.code).toBe('HAS_DEPENDENT_JOURNEYS');
  });

  it('22. Deve excluir jornadas limpando progresso e builds vinculados, liberando remoção posterior da biblioteca', async () => {
    // Create a journey on userAEntry2Id with progress & build, delete journey, then delete userAEntry2Id
    const jRes = await request(app)
      .post('/api/journeys')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ userGameId: userAEntry2Id, name: 'Run Hollow' });
    expect(jRes.status).toBe(201);
    const jTempId = jRes.body.data.id;

    const pRes = await request(app)
      .post(`/api/journeys/${jTempId}/progress`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ description: 'Derrotado Cavaleiro Falso' });
    expect(pRes.status).toBe(201);
    const pTempId = pRes.body.data.id;

    const bRes = await request(app)
      .post(`/api/journeys/${jTempId}/builds`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ name: 'Amuletos Ferrão Rápido' });
    expect(bRes.status).toBe(201);
    const bTempId = bRes.body.data.id;

    const delJourney = await request(app)
      .delete(`/api/journeys/${jTempId}`)
      .set('Authorization', `Bearer ${userAToken}`);
    expect(delJourney.status).toBe(204);

    // Dependent logs and builds must be gone
    const orphanP = await prisma.progressLog.findUnique({ where: { id: pTempId } });
    const orphanB = await prisma.gameBuild.findUnique({ where: { id: bTempId } });
    expect(orphanP).toBeNull();
    expect(orphanB).toBeNull();

    // Library entry can now be removed cleanly
    const delLibOk = await request(app)
      .delete(`/api/library/${userAEntry2Id}`)
      .set('Authorization', `Bearer ${userAToken}`);
    expect(delLibOk.status).toBe(204);
  });

  it('23. Deve expor todos os endpoints de Jornadas, Progresso e Builds na especificação OpenAPI (/api/docs.json)', async () => {
    const res = await request(app).get('/api/docs.json');
    expect(res.status).toBe(200);
    expect(res.body.paths['/api/journeys']).toBeDefined();
    expect(res.body.paths['/api/journeys/{id}']).toBeDefined();
    expect(res.body.paths['/api/journeys/{id}/activate']).toBeDefined();
    expect(res.body.paths['/api/journeys/{id}/progress']).toBeDefined();
    expect(res.body.paths['/api/progress/{id}']).toBeDefined();
    expect(res.body.paths['/api/journeys/{id}/builds']).toBeDefined();
    expect(res.body.paths['/api/builds/{id}']).toBeDefined();
    expect(res.body.components.schemas.GameplayJourney).toBeDefined();
    expect(res.body.components.schemas.ProgressLog).toBeDefined();
    expect(res.body.components.schemas.GameBuild).toBeDefined();
  });
});
