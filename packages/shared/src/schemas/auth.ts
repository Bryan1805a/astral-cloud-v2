import { z } from "zod";

export const registerSchema = z
  .object({
    username: z
      .string()
      .min(3)
      .max(32)
      .regex(/^[a-zA-Z0-9_]+$/, "Username must be alphanumeric with underscores"),
    email: z.string().email().max(255),
    password: z
      .string()
      .min(8)
      .max(128)
      .regex(/[A-Z]/, "Must contain at least one uppercase letter")
      .regex(/[a-z]/, "Must contain at least one lowercase letter")
      .regex(/[0-9]/, "Must contain at least one digit"),
    confirmPassword: z.string(),
    referralCode: z.string().max(16).optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1),
  rememberMe: z.boolean().optional().default(false),
  totpCode: z.string().length(6).optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().max(255),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z
    .string()
    .min(8)
    .max(128)
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[a-z]/, "Must contain at least one lowercase letter")
    .regex(/[0-9]/, "Must contain at least one digit"),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export const enable2faSchema = z.object({
  totpCode: z.string().length(6),
});

export const disable2faSchema = z.object({
  totpCode: z.string().length(6),
});

export const verify2faSchema = z.object({
  tempToken: z.string().min(1),
  totpCode: z.string().length(6),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z
      .string()
      .min(8)
      .max(128)
      .regex(/[A-Z]/, "Must contain at least one uppercase letter")
      .regex(/[a-z]/, "Must contain at least one lowercase letter")
      .regex(/[0-9]/, "Must contain at least one digit"),
    confirmNewPassword: z.string(),
    totpCode: z.string().length(6).optional(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  });

export const updateProfileSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/).optional(),
  email: z.string().email().max(255).optional(),
  billingAddress: z
    .object({
      line1: z.string().min(1),
      line2: z.string().optional().nullable(),
      city: z.string().min(1),
      state: z.string().min(1),
      postal: z.string().min(1),
      country: z.string().length(2),
    })
    .optional()
    .nullable(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type Enable2faInput = z.infer<typeof enable2faSchema>;
export type Disable2faInput = z.infer<typeof disable2faSchema>;
export type Verify2faInput = z.infer<typeof verify2faSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
