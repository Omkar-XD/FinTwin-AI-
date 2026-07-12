import { cors } from "hono/cors";
import { env } from "./env.js";

const allowedOrigins = [
  "http://localhost:3000",
  env.frontendUrl,
].filter((origin): origin is string => Boolean(origin));

export const corsMiddleware = cors({
  origin: (origin) => {
    // Requests like Postman or server-to-server may not send an Origin header
    if (!origin) {
      return allowedOrigins[0];
    }

    // Allow only configured origins
    if (allowedOrigins.includes(origin)) {
      return origin;
    }

    // Reject all others
    return "";
  },

  allowMethods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowHeaders: [
    "Content-Type",
    "Authorization",
  ],

  exposeHeaders: [
    "Content-Length",
    "Content-Type",
  ],

  credentials: true,

  maxAge: 86400,
});