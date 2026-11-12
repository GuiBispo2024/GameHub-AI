import { z } from 'zod';

export const registerSchema = z
  .object({
    username: z
      .string()
      .min(3, { message: 'O nome de usuário deve ter no mínimo 3 caracteres' })
      .max(30, { message: 'O nome de usuário deve ter no máximo 30 caracteres' })
      .regex(/^[a-zA-Z0-9_-]+$/, {
        message: 'O nome de usuário só pode conter letras, números, sublinhados e hífens',
      }),
    email: z
      .string()
      .email({ message: 'Endereço de email inválido' })
      .max(255, { message: 'Email muito longo' }),
    password: z
      .string()
      .min(8, { message: 'A senha deve ter no mínimo 8 caracteres' })
      .max(100, { message: 'A senha deve ter no máximo 100 caracteres' })
      .regex(/[A-Z]/, { message: 'A senha deve conter pelo menos uma letra maiúscula' })
      .regex(/[a-z]/, { message: 'A senha deve conter pelo menos uma letra minúscula' })
      .regex(/[0-9]/, { message: 'A senha deve conter pelo menos um número' }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: z
    .string()
    .email({ message: 'Endereço de email inválido' }),
  password: z
    .string()
    .min(1, { message: 'A senha é obrigatória' }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
