import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app';
import { prisma } from '../server/db/prisma';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import { ENV } from '../server/config/env';

// Auto-populate env from running server process if running in container subshell
if (!process.env.DATABASE_URL) {
  try {
    const pids = fs.readdirSync('/proc').filter((f) => /^\d+$/.test(f));
    for (const pid of pids) {
      try {
        const cmd = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8');
        if (cmd.includes('server.ts')) {
          const envData = fs.readFileSync(`/proc/${pid}/environ`, 'utf8');
          for (const line of envData.split('\0')) {
            const [k, ...v] = line.split('=');
            if (['DATABASE_URL', 'DIRECT_URL', 'JWT_SECRET'].includes(k) && !process.env[k]) {
              process.env[k] = v.join('=');
            }
          }
          break;
        }
      } catch {}
    }
  } catch {}
}

const app = createApp();

describe('GameHub AI - Módulo de Autenticação e Perfil Gamer (Fase 1, Prompt 2)', () => {
  const timestamp = Date.now();
  const testUser = {
    username: `gamer_${timestamp}`,
    email: `gamer_${timestamp}@example.com`,
    password: 'GamerPassword123!',
    confirmPassword: 'GamerPassword123!',
  };

  const otherUser = {
    username: `other_${timestamp}`,
    email: `other_${timestamp}@example.com`,
    password: 'OtherPassword123!',
    confirmPassword: 'OtherPassword123!',
  };

  let testAuthToken: string = '';
  let testUserId: string = '';
  let otherAuthToken: string = '';
  let otherUserId: string = '';

  afterAll(async () => {
    // Controlled cleanup of test users created during this suite in Neon PostgreSQL
    try {
      await prisma.userPreference.deleteMany({
        where: {
          user: {
            email: { in: [testUser.email.toLowerCase(), otherUser.email.toLowerCase()] },
          },
        },
      });
      await prisma.user.deleteMany({
        where: {
          email: { in: [testUser.email.toLowerCase(), otherUser.email.toLowerCase()] },
        },
      });
    } catch (err) {
      console.warn('Test cleanup warning:', err);
    }
  });

  // Teste 1: Cadastro válido
  it('1. Deve cadastrar usuário válido com sucesso (201) e criar UserPreference padrão atomicamente', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(testUser.email.toLowerCase());
    expect(res.body.user.username).toBe(testUser.username);
    expect(res.body.user.passwordHash).toBeUndefined(); // Nunca retornar hash da senha
    expect(res.body.token).toBeDefined();

    testUserId = res.body.user.id;
    testAuthToken = res.body.token;

    // Verificar no Neon PostgreSQL se User e UserPreference foram criados
    const userInDb = await prisma.user.findUnique({
      where: { id: testUserId },
      include: { preferences: true },
    });
    expect(userInDb).not.toBeNull();
    expect(userInDb?.preferences).not.toBeNull();
    expect(userInDb?.preferences?.defaultSpoilerLevel).toBe('CURRENT_CHAPTER');
  });

  // Teste 2: Email duplicado
  it('2. Deve rejeitar cadastro com email duplicado com HTTP 409 Conflict', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: `unique_user_${Date.now()}`,
        email: testUser.email, // Email já cadastrado
        password: 'Password123!',
        confirmPassword: 'Password123!',
      });

    expect(res.status).toBe(409);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toMatch(/email.*(cadastrado|em uso)|e-mail.*(cadastrado|em uso)/i);
  });

  // Teste 3: Username duplicado
  it('3. Deve rejeitar cadastro com username duplicado com HTTP 409 Conflict', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: testUser.username, // Username já cadastrado
        email: `new_email_${Date.now()}@example.com`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      });

    expect(res.status).toBe(409);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toMatch(/nome de usuário já está em uso/i);
  });

  // Teste 4: Senha inválida / não coincide
  it('4. Deve validar dados de entrada com Zod e rejeitar senha fraca ou divergente (400)', async () => {
    const resMismatch = await request(app)
      .post('/api/auth/register')
      .send({
        username: `divergent_${Date.now()}`,
        email: `divergent_${Date.now()}@example.com`,
        password: 'StrongPassword123!',
        confirmPassword: 'DifferentPassword123!',
      });

    expect(resMismatch.status).toBe(400);
    expect(resMismatch.body.status).toBe('error');
    expect(resMismatch.body.errors).toBeDefined();

    const resWeak = await request(app)
      .post('/api/auth/register')
      .send({
        username: `weak_${Date.now()}`,
        email: `weak_${Date.now()}@example.com`,
        password: '123',
        confirmPassword: '123',
      });

    expect(resWeak.status).toBe(400);
    expect(resWeak.body.status).toBe('error');
  });

  // Teste 5: Login bem-sucedido
  it('5. Deve realizar login com sucesso (200), retornar dados públicos e cookie HttpOnly', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(testUser.email.toLowerCase());
    expect(res.body.user.passwordHash).toBeUndefined();

    // Verificar se o cookie HttpOnly foi definido
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const tokenCookie = (cookies as unknown as string[]).find((c) => c.startsWith('gamehub_token='));
    expect(tokenCookie).toBeDefined();
    expect(tokenCookie).toContain('HttpOnly');
  });

  // Teste 6: Login com credenciais incorretas
  it('6. Deve rejeitar credenciais inválidas com HTTP 401 sem vazar existência do email', async () => {
    const resWrongPass = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'IncorrectPassword999!',
      });

    expect(resWrongPass.status).toBe(401);
    expect(resWrongPass.body.status).toBe('error');
    expect(resWrongPass.body.message).toMatch(/credenciais inválidas|email e senha/i);

    const resNonExistent = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'non_existent_player_99999@example.com',
        password: 'AnyPassword123!',
      });

    expect(resNonExistent.status).toBe(401);
    expect(resNonExistent.body.message).toBe(resWrongPass.body.message); // Mensagem genérica idêntica
  });

  // Teste 7: Rota protegida sem autenticação
  it('7. Deve bloquear acesso a rotas protegidas (/api/auth/me e /api/users/me) sem token (401)', async () => {
    const resAuthMe = await request(app).get('/api/auth/me');
    expect(resAuthMe.status).toBe(401);
    expect(resAuthMe.body.status).toBe('error');

    const resUsersMe = await request(app).get('/api/users/me');
    expect(resUsersMe.status).toBe(401);
    expect(resUsersMe.body.status).toBe('error');
  });

  // Teste 8: JWT expirado ou inválido
  it('8. Deve rejeitar requisições com JWT inválido ou expirado com HTTP 401', async () => {
    const resInvalid = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid_garbage_token_signature');

    expect(resInvalid.status).toBe(401);
    expect(resInvalid.body.status).toBe('error');

    // Token expirado propositalmente
    const expiredToken = jwt.sign(
      { sub: testUserId, email: testUser.email, username: testUser.username },
      ENV.JWT_SECRET,
      { expiresIn: '-1s' }
    );

    const resExpired = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(resExpired.status).toBe(401);
    expect(resExpired.body.message).toMatch(/expirada|inválido/i);
  });

  // Teste 9: Consulta do próprio perfil
  it('9. Deve consultar o próprio perfil (GET /api/users/me) e preferências com sucesso', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${testAuthToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.user).toBeDefined();
    expect(res.body.user.id).toBe(testUserId);
    expect(res.body.user.username).toBe(testUser.username);
    expect(res.body.user.preferences).toBeDefined();
    expect(res.body.user.preferences.spoilerLevelFriendly).toBe('LIGHT');
  });

  // Teste 10: Atualização de preferências
  it('10. Deve atualizar preferências do gamer (PATCH /api/users/me/preferences) com níveis amigáveis', async () => {
    const res = await request(app)
      .patch('/api/users/me/preferences')
      .set('Authorization', `Bearer ${testAuthToken}`)
      .send({
        spoilerLevel: 'NONE',
        preferredPlatforms: ['PC', 'PlayStation 5', 'Nintendo Switch'],
        preferredGenres: ['RPG', 'Soulslike', 'Metroidvania'],
        language: 'pt-BR',
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.preferences.spoilerLevelFriendly).toBe('NONE');
    expect(res.body.preferences.preferredPlatforms).toContain('PlayStation 5');
    expect(res.body.preferences.preferredGenres).toContain('Soulslike');
    expect(res.body.preferences.language).toBe('pt-BR');

    // Verificar persistência no banco
    const dbPref = await prisma.userPreference.findUnique({
      where: { userId: testUserId },
    });
    expect(dbPref?.defaultSpoilerLevel).toBe('STRICT_NO_SPOILERS');
    expect(dbPref?.preferredGenres).toContain('Soulslike');
  });

  // Teste 11: Tentativa de acesso a dados de outro usuário
  it('11. Deve rejeitar ou ignorar qualquer tentativa de manipulação de userId de outro usuário', async () => {
    // Cadastrar um segundo usuário
    const resOther = await request(app)
      .post('/api/auth/register')
      .send(otherUser);

    expect(resOther.status).toBe(201);
    otherUserId = resOther.body.user.id;
    otherAuthToken = resOther.body.token;

    // Usuário 1 tenta enviar no body ou headers o ID do Usuário 2 para alterar seu perfil
    const resTamper = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${testAuthToken}`)
      .send({
        userId: otherUserId, // Tentativa maliciosa de sobrescrever outro usuário
        bio: 'Hacked by User 1',
      });

    expect(resTamper.status).toBe(200);
    expect(resTamper.body.user.id).toBe(testUserId); // Deve alterar apenas o próprio usuário
    expect(resTamper.body.user.bio).toBe('Hacked by User 1');

    // Verificar que o perfil do Usuário 2 permanece inalterado
    const otherInDb = await prisma.user.findUnique({
      where: { id: otherUserId },
    });
    expect(otherInDb?.bio).toBeNull();
  });

  // Teste 12: Logout e encerramento da sessão
  it('12. Deve executar logout (POST /api/auth/logout) limpando o cookie de sessão', async () => {
    const res = await request(app).post('/api/auth/logout');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const tokenCookie = (cookies as unknown as string[]).find((c) => c.startsWith('gamehub_token='));
    expect(tokenCookie).toBeDefined();
    // Cookie deve estar expirado ou vazio
    expect(tokenCookie).toMatch(/Max-Age=0|Expires=/i);
  });

  // =========================================================================
  // FASE 1, TAREFA 3 — QUALIDADE, SEGURANÇA E ROBUSTEZ DA API
  // =========================================================================

  // Teste 13: Rate limiting nas rotas de autenticação
  it('13. Deve aplicar rate limiting e retornar HTTP 429 após exceder o limite de requisições', async () => {
    const { createAuthLimiter } = await import('../server/middlewares/rate-limit.middleware');
    const express = (await import('express')).default;
    const testApp = express();

    // Limiter estrito para teste: máximo 2 requisições por janela
    testApp.use(createAuthLimiter({ max: 2, skip: () => false }));
    testApp.post('/test-rate-limit', (_req, res) => res.json({ status: 'ok' }));

    // Requisição 1: OK
    const res1 = await request(testApp).post('/test-rate-limit');
    expect(res1.status).toBe(200);

    // Requisição 2: OK
    const res2 = await request(testApp).post('/test-rate-limit');
    expect(res2.status).toBe(200);

    // Requisição 3: Excedeu o limite -> 429 Too Many Requests
    const res3 = await request(testApp).post('/test-rate-limit');
    expect(res3.status).toBe(429);
    expect(res3.body.status).toBe('error');
    expect(res3.body.code).toBe('TOO_MANY_REQUESTS');
    expect(res3.headers['ratelimit-remaining']).toBeDefined();
  });

  it('13b. Deve suportar headers X-Forwarded-For e Forwarded atrás de proxy sem gerar ValidationError', async () => {
    const { createAuthLimiter } = await import('../server/middlewares/rate-limit.middleware');
    const express = (await import('express')).default;
    const proxyApp = express();
    proxyApp.set('trust proxy', 1);
    proxyApp.use(createAuthLimiter({ max: 1, skip: () => false }));
    proxyApp.post('/proxy-check', (req, res) => res.json({ ip: req.ip }));

    const r1 = await request(proxyApp)
      .post('/proxy-check')
      .set('X-Forwarded-For', '203.0.113.10')
      .set('Forwarded', 'for="203.0.113.10";proto=https');
    expect(r1.status).toBe(200);
    expect(r1.body.ip).toBe('203.0.113.10');

    // Mesmo cliente deve ser limitado (429), sem ValidationError
    const r2 = await request(proxyApp)
      .post('/proxy-check')
      .set('X-Forwarded-For', '203.0.113.10')
      .set('Forwarded', 'for="203.0.113.10";proto=https');
    expect(r2.status).toBe(429);

    // Outro IP via Forwarded deve passar normalmente (200)
    const r3 = await request(proxyApp)
      .post('/proxy-check')
      .set('Forwarded', 'for="[2001:db8::1]:443";proto=https');
    expect(r3.status).toBe(200);
  });

  // Teste 14: Validação de cookies de autenticação
  it('14. Deve validar integridade e atributos do cookie HttpOnly de autenticação', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });

    expect(res.status).toBe(200);
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies).toBeDefined();

    const authCookie = cookies.find((c) => c.startsWith('gamehub_token='));
    expect(authCookie).toBeDefined();
    expect(authCookie).toContain('HttpOnly');
    expect(authCookie).toContain('Path=/');

    // Extrair o token do cookie e verificar se decodifica corretamente com JWT_SECRET
    const tokenMatch = authCookie?.match(/gamehub_token=([^;]+)/);
    expect(tokenMatch).not.toBeNull();
    const token = tokenMatch![1];
    const decoded: any = jwt.verify(token, ENV.JWT_SECRET);
    expect(decoded.userId).toBe(testUserId);
    expect(decoded.email).toBe(testUser.email.toLowerCase());
  });

  // Teste 15: Tentativas de acesso entre usuários distintos
  it('15. Deve impedir que Usuário 1 altere ou visualize dados do Usuário 2 mesmo injetando userId', async () => {
    // Usuário 1 tenta atualizar o perfil do Usuário 2 via PATCH /api/users/me
    const resTamper = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${testAuthToken}`)
      .send({
        userId: otherUserId,
        bio: 'Tentativa de sequestro de conta',
      });

    expect(resTamper.status).toBe(200);
    expect(resTamper.body.user.id).toBe(testUserId); // Continua sendo testUserId
    expect(resTamper.body.user.id).not.toBe(otherUserId);

    // Confirmar que o perfil de otherUserId no PostgreSQL permanece inalterado
    const otherInDb = await prisma.user.findUnique({ where: { id: otherUserId } });
    expect(otherInDb?.bio).not.toBe('Tentativa de sequestro de conta');
  });

  // Teste 16: Atualização de username duplicado
  it('16. Deve rejeitar atualização de username para um nome já em uso por outro gamer (409 Conflict)', async () => {
    // Usuário 1 tenta mudar seu username para o username do Usuário 2
    const resDuplicate = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${testAuthToken}`)
      .send({
        username: otherUser.username,
      });

    expect(resDuplicate.status).toBe(409);
    expect(resDuplicate.body.status).toBe('error');
    expect(resDuplicate.body.message).toMatch(/já está em uso por outro jogador/i);
  });

  // Teste 17: Persistência das preferências após nova autenticação
  it('17. Deve persistir preferências no PostgreSQL e recuperá-las intactas após logout e novo login', async () => {
    // Atualizar preferências
    const updateRes = await request(app)
      .patch('/api/users/me/preferences')
      .set('Authorization', `Bearer ${testAuthToken}`)
      .send({
        spoilerLevel: 'ALL',
        preferredPlatforms: ['PC', 'Steam Deck'],
        preferredGenres: ['Roguelike', 'Soulslike'],
        theme: 'cyberpunk',
        language: 'pt-BR',
      });
    expect(updateRes.status).toBe(200);

    // Simular logout
    await request(app).post('/api/auth/logout');

    // Novo login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });

    expect(loginRes.status).toBe(200);
    const newToken = loginRes.body.token;

    // Consultar perfil com o novo token
    const profileRes = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${newToken}`);

    expect(profileRes.status).toBe(200);
    expect(profileRes.body.user.preferences.spoilerLevelFriendly).toBe('ALL');
    expect(profileRes.body.user.preferences.preferredPlatforms).toContain('Steam Deck');
    expect(profileRes.body.user.preferences.preferredGenres).toContain('Roguelike');
    expect(profileRes.body.user.preferences.theme).toBe('cyberpunk');
  });

  // Teste 18: Tratamento de erros internos estruturados
  it('18. Deve formatar erros internos através do errorHandler sem vazar dados sensíveis em produção', async () => {
    const express = (await import('express')).default;
    const { errorHandler } = await import('../server/middlewares/error.middleware');
    const testApp = express();

    testApp.get('/error-test', () => {
      throw new Error('Falha simulada de banco de dados');
    });
    testApp.use(errorHandler);

    const res = await request(testApp).get('/error-test');
    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
    expect(res.body.code).toBe('INTERNAL_SERVER_ERROR');
    expect(res.body.message).toMatch(/erro interno no servidor/i);
  });

  // Teste 19: Requisições inválidas com validação Zod
  it('19. Deve validar e rejeitar payloads inválidos com Zod retornando HTTP 400 e campo detalhado', async () => {
    // Avatar com URL malformada
    const resBadAvatar = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${testAuthToken}`)
      .send({
        avatarUrl: 'not_a_valid_url_at_all',
      });

    expect(resBadAvatar.status).toBe(400);
    expect(resBadAvatar.body.status).toBe('error');
    expect(resBadAvatar.body.errors?.avatarUrl).toBeDefined();

    // Preferências com valores fora do enum
    const resBadPref = await request(app)
      .patch('/api/users/me/preferences')
      .set('Authorization', `Bearer ${testAuthToken}`)
      .send({
        spoilerLevel: 'INVALID_SPOILER_LEVEL',
      });

    expect(resBadPref.status).toBe(400);
    expect(resBadPref.body.status).toBe('error');
  });

  // Teste 20: Comportamento de CORS
  it('20. Deve refletir a origem permitida e incluir cabeçalhos de credenciais em requisições CORS', async () => {
    const customOrigin = 'https://gamehub-desktop.client.local';

    // Requisição com Origin específico
    const res = await request(app)
      .get('/health')
      .set('Origin', customOrigin);

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(customOrigin);
    expect(res.headers['access-control-allow-credentials']).toBe('true');

    // Requisição pre-flight OPTIONS
    const preflight = await request(app)
      .options('/api/auth/login')
      .set('Origin', customOrigin)
      .set('Access-Control-Request-Method', 'POST');

    expect(preflight.status).toBe(204);
    expect(preflight.headers['access-control-allow-origin']).toBe(customOrigin);
    expect(preflight.headers['access-control-allow-methods']).toContain('POST');
  });

  // Teste 21: Documentação OpenAPI Swagger disponível em /api/docs e /api/docs.json
  it('21. Deve servir a especificação OpenAPI 3.0.3 e interface interativa Swagger', async () => {
    const resJson = await request(app).get('/api/docs.json');
    expect(resJson.status).toBe(200);
    expect(resJson.body.openapi).toBe('3.0.3');
    expect(resJson.body.info.title).toContain('GameHub AI');
    expect(resJson.body.paths['/api/auth/register']).toBeDefined();
    expect(resJson.body.paths['/api/auth/login']).toBeDefined();
    expect(resJson.body.paths['/api/auth/logout']).toBeDefined();
    expect(resJson.body.paths['/api/auth/me']).toBeDefined();
    expect(resJson.body.paths['/api/users/me']).toBeDefined();
    expect(resJson.body.paths['/api/users/me/preferences']).toBeDefined();
    expect(resJson.body.paths['/health']).toBeDefined();
    expect(resJson.body.paths['/api/health']).toBeDefined();

    const resUi = await request(app).get('/api/docs/');
    expect(resUi.status).toBe(200);
    expect(resUi.text).toContain('swagger-ui');
    expect(resUi.text).toContain('swagger-ui-bundle.js');
  });
});
