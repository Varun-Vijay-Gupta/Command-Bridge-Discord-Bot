/// <reference types="vite/client" />

interface ImportMetaEnv {
  PROD: any;
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
