import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().startsWith('rzp_').optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  REDIS_URL: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
    z.string().regex(/^rediss?:\/\//, 'Must start with redis:// or rediss://').optional(),
  ),
  MSG91_AUTH_KEY: z.string().optional(),
  MSG91_TEMPLATE_ID: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  PHONE_AUTH_STRATEGY: z.enum(['backend', 'firebase']).default('backend'),
  CLIENT_URL: z.string().url().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
}).superRefine((data, ctx) => {
  // SMTP vars must be all-or-nothing
  const smtpVars = [data.SMTP_HOST, data.SMTP_PORT, data.SMTP_USER, data.SMTP_PASS]
  const smtpSet = smtpVars.filter(Boolean).length
  if (smtpSet > 0 && smtpSet < 4) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS must all be set together',
    })
  }

  // Firebase Admin vars must be all-or-nothing
  const fbVars = [data.FIREBASE_PROJECT_ID, data.FIREBASE_CLIENT_EMAIL, data.FIREBASE_PRIVATE_KEY]
  const fbSet = fbVars.filter(Boolean).length
  if (fbSet > 0 && fbSet < 3) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY must all be set together',
    })
  }
})

export const env = envSchema.parse(process.env)
