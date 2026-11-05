import { rateLimit } from "express-rate-limit";

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

export const firmaRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120, // 120 peticiones por minuto (admite holgadamente el sondeo de 2 s)
  standardHeaders: true,
  legacyHeaders: false,
});
