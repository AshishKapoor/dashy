/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEV_MODE: string;
  readonly VITE_DATA_SERVICE_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
