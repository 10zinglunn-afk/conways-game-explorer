import { getDatabaseConnectionString } from './auth.mjs';

export function getCommunityConfig(env = process.env) {
  if (getDatabaseConnectionString(env) && env.BETTER_AUTH_SECRET) {
    return {
      backend: 'postgres',
      apiBase: '/api/community',
      authBase: '/api/auth',
    };
  }

  if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
    return {
      backend: 'supabase',
      supabaseUrl: env.SUPABASE_URL,
      supabaseAnonKey: env.SUPABASE_ANON_KEY,
    };
  }

  return { backend: 'local' };
}

export function renderCommunityConfigScript(env = process.env) {
  return `window.LIFE_LOGIC_COMMUNITY = ${JSON.stringify(getCommunityConfig(env))};\n`;
}

export function injectCommunityConfig(html, env = process.env) {
  return html.replace(
    /<script id="life-runtime-config" type="application\/json">[\s\S]*?<\/script>/,
    `<script id="life-runtime-config" type="application/json">${JSON.stringify(getCommunityConfig(env))}</script>`,
  );
}
