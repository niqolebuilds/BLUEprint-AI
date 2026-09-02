/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_REMOTE_AUTH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
