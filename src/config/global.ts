import dotenv from 'dotenv';
dotenv.config();

export const {
  PORT = '',
  ALLOWED_ORIGIN = 'http://localhost:5173',
  SUPABASE_URL = '',
  SUPABASE_SERVICE_ROLE_KEY = '',
} = process.env;

export const config = {
  port: Number(PORT) || 3000,
  allowedOrigin: ALLOWED_ORIGIN.split(',').map((origin) => origin.trim()),
  db: {
    url: SUPABASE_URL,
    serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
  },
};
