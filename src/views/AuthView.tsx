import React, { useState } from 'react';
import {
  Gamepad2,
  Mail,
  Lock,
  User,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../contexts/AuthContext';
import { NavTab } from '../types';

interface AuthViewProps {
  onSuccessNavigate?: (tab: NavTab) => void;
  initialMode?: 'login' | 'register';
}

export function AuthView({ onSuccessNavigate, initialMode = 'login' }: AuthViewProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const { login, register } = useAuth();

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
      setTimeout(() => {
        if (onSuccessNavigate) onSuccessNavigate('profile');
      }, 700);
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
      setSuccessMessage('Conta gamer criada com sucesso! Redirecionando...');
      setTimeout(() => {
        if (onSuccessNavigate) onSuccessNavigate('profile');
      }, 800);
    } catch (err: any) {
      setFormError(err.message || 'Erro ao criar conta.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-6 space-y-6">
      {/* Brand Hero for Auth */}
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-blue-600 flex items-center justify-center shadow-xl shadow-violet-600/30 border border-violet-400/40 mx-auto">
          <Gamepad2 className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight">
          GameHub <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-blue-400">AI</span>
        </h1>
        <p className="text-xs text-slate-400">
          Sua biblioteca inteligente de jogos e acompanhamento de gameplay com IA.
        </p>
      </div>

      {/* Auth Card */}
      <Card glow="violet" className="border-violet-500/30 shadow-2xl shadow-violet-950/40">
        {/* Toggle Mode Tabs */}
        <div className="grid grid-cols-2 p-1 bg-slate-950/80 border-b border-slate-800">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setFormError(null);
              setSuccessMessage(null);
            }}
            className={`py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              mode === 'login'
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Entrar (Login)
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setFormError(null);
              setSuccessMessage(null);
            }}
            className={`py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              mode === 'register'
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Criar Conta
          </button>
        </div>

        <CardContent className="p-6 space-y-4">
          {/* Error Message Alert */}
          {formError && (
            <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-700/60 text-red-200 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {/* Success Message Alert */}
          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-700/60 text-emerald-200 text-xs flex items-start gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Login Form */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Email Gamer</label>
                <Input
                  type="email"
                  placeholder="seu.email@exemplo.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  leftIcon={<Mail className="w-4 h-4" />}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Senha</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4" />}
                  required
                />
              </div>

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
          )}

          {/* Register Form */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Nome de Usuário (Gamer Tag)</label>
                <Input
                  type="text"
                  placeholder="ex: GhostRider99"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  leftIcon={<User className="w-4 h-4" />}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Email</label>
                <Input
                  type="email"
                  placeholder="seu.email@exemplo.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  leftIcon={<Mail className="w-4 h-4" />}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Senha (mínimo 8 caracteres)</label>
                <Input
                  type="password"
                  placeholder="Maiúsculas, minúsculas e números"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4" />}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Confirmar Senha</label>
                <Input
                  type="password"
                  placeholder="Repita sua senha"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  leftIcon={<KeyRound className="w-4 h-4" />}
                  required
                />
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Senhas protegidas com hashing criptográfico Argon2id.</span>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full mt-2"
                isLoading={isLoading}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Criar Conta Gamer
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
