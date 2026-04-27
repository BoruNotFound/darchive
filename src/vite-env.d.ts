/// <reference types="vite/client" />

// Augment Vite's ImportMetaEnv with our project-specific env vars so
// `import.meta.env.VITE_SUPABASE_URL` is typed (not just `string | undefined`).
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
