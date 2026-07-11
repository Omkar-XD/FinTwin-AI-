import { Hono } from 'hono';
import { supabaseAuthMiddleware, type AppBindings } from '../lib/auth.js';
import { assistantRoutes } from './assistant.js';
import { dashboardRoutes } from './dashboard.js';
import { documentRoutes } from './documents.js';
import { healthRoutes } from './health.js';
import { profileRoutes } from './profile.js';
import { recommendationRoutes } from './recommendations.js';
import { simulationRoutes } from './simulation.js';

export const routes = new Hono<AppBindings>();

routes.route('/health', healthRoutes);
routes.use('*', supabaseAuthMiddleware);
routes.route('/documents', documentRoutes);
routes.route('/dashboard', dashboardRoutes);
routes.route('/profile', profileRoutes);
routes.route('/recommendations', recommendationRoutes);
routes.route('/simulation', simulationRoutes);
routes.route('/assistant', assistantRoutes);
