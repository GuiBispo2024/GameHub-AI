import React, { useState } from 'react';
import {
  Gamepad2,
  Mail,
  Lock,
  User,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Tabs } from '../components/ui/Tabs';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { NavTab } from '../types';

interface AuthViewProps {
  onSuccessNavigate?: (tab: NavTab) => void;
  initialMode?: 'login' | 'register';
}

export function AuthView({ onSuccessNavigate, initialMode = 'login' }: AuthViewProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const { login, register } = useAuth();
  const { showToast } = useToast();

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleModeChange = (nextMode: 'login' | 'register') => {
    setMode(nextMode);
    setFormError(null);
    setSuccessMessage(null);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (!loginEmail.trim() || !loginPassword) {
      setFormError('Por favor, preencha todos os campos.');
      return;
    }

    try {
      setIsLoading(true);
      await login(loginEmail, loginPassword);
      setSuccessMessage('Login realizado com sucesso! Redirecionando...');
      showToast({ variant: 'success', message: 'Sessão iniciada com sucesso.' });
      setTimeout(() => {
        if (onSuccessNavigate) onSuccessNavigate('dashboard');
      }, 450);
    } catch (err: any) {
      setFormError(err.message || 'Credenciais inválidas.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (!regUsername.trim() || !regEmail.trim() || !regPassword || !regConfirmPassword) {
      setFormError('Todos os campos são obrigatórios.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setFormError('As senhas não coincidem.');
      return;
    }

    if (regPassword.length < 8) {
      setFormError('A senha deve ter no mínimo 8 caracteres, com maiúsculas, minúsculas e números.');
      return;
    }

    try {
      setIsLoading(true);
      await register(regUsername, regEmail, regPassword, regConfirmPassword);
      setSuccessMessage('Conta criada com sucesso! Redirecionando...');
      showToast({ variant: 'success', message: 'Bem-vindo ao GameHub AI!' });
      setTimeout(() => {
        if (onSuccessNavigate) onSuccessNavigate('profile');
      }, 500);
    } catch (err: any) {
      setFormError(err.message || 'Erro ao criar conta.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-4 sm:my-8 space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-blue-600 flex items-center justify-center shadow-lg shadow-violet-950/50 mx-auto">
          <Gamepad2 className="w-6 h-6 text-white" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          GameHub AI
        </h1>
        <p className="text-xs sm:text-sm text-slate-400">
          Acesse sua biblioteca pessoal, jornadas e Game Companion.
        </p>
      </div>

      <Card glow="violet" className="border-slate-700/80">
        <div className="p-2 bg-[var(--bg-inset)] border-b border-slate-800">
          <Tabs
            activeId={mode}
            onChange={handleModeChange}
            ariaLabel="Modo de autenticação"
            className="grid grid-cols-2"
            items={[
              { id: 'login', label: 'Entrar' },
              { id: 'register', label: 'Criar Conta' },
            ]}
          />
        </div>

        <CardContent className="p-5 sm:p-6 space-y-4">
          {formError && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{formError}</span>
            </div>
          )}

          {successMessage && (
            <div
              role="status"
              className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-start gap-2.5"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{successMessage}</span>
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4" noValidate>
              <Input
                label="E-mail"
                type="email"
                autoComplete="email"
                placeholder="seu.email@exemplo.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                leftIcon={<Mail className="w-4 h-4" />}
                required
              />

              <Input
                label="Senha"
                type="password"
                autoComplete="current-password"
                placeholder="Sua senha de acesso"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                required
              />

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full mt-2"
                isLoading={isLoading}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Entrar na Plataforma
              </Button>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5" noValidate>
              <Input
                label="Nome de Usuário (Gamer Tag)"
                type="text"
                autoComplete="username"
                placeholder="Ex: GhostRider99"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                leftIcon={<User className="w-4 h-4" />}
                required
              />

              <Input
                label="E-mail"
                type="email"
                autoComplete="email"
                placeholder="seu.email@exemplo.com"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                leftIcon={<Mail className="w-4 h-4" />}
                required
              />

              <Input
                label="Senha"
                type="password"
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                helperText="Use letras maiúsculas, minúsculas e números."
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                required
              />

              <Input
                label="Confirmar Senha"
                type="password"
                autoComplete="new-password"
                placeholder="Repita sua senha"
                value={regConfirmPassword}
                onChange={(e) => setRegConfirmPassword(e.target.value)}
                leftIcon={<KeyRound className="w-4 h-4" />}
                required
              />

              <div className="p-2.5 rounded-xl bg-[var(--bg-inset)] border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                <span>Sua conta e preferências são armazenadas com segurança.</span>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full mt-2"
                isLoading={isLoading}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Criar Conta
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
