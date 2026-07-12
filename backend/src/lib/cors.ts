import { cors } from "hono/cors";
import { env } from "./env.js";

export function getAllowedOrigins(): string[] {
  const origins = new Set<string>();

  // Allow localhost only during local development
  if (env.nodeEnv !== "production") {
    origins.add("http://localhost:3000");
  }

  // Allow deployed frontend
  if (env.frontendUrl) {
    origins.add(env.frontendUrl);
  }

  return Array.from(origins);
}

export const corsMiddleware = cors({
  origin: (origin) => {
    const allowedOrigins = getAllowedOrigins();

    // DEBUG LOGS
    console.log("=================================");
    console.log("Incoming Origin:", origin);
    console.log("NODE_ENV:", env.nodeEnv);
    console.log("FRONTEND_URL:", env.frontendUrl);
    console.log("Allowed Origins:", allowedOrigins);
    console.log("=================================");

    // Requests without Origin (Postman, curl, internal services)
    if (!origin) {
      return allowedOrigins[0] ?? "";
    }

    // Allow configured origins
    if (allowedOrigins.includes(origin)) {
      return origin;
    }

    // Reject all other origins
    console.warn(`❌ Blocked Origin: ${origin}`);
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
    "Accept",
    "Origin",
    "X-Requested-With",
  ],

  exposeHeaders: [
    "Content-Length",
    "Content-Type",
  ],

  credentials: true,

  maxAge: 86400,
});