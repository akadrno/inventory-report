/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLIENT_ID: string
  readonly VITE_TENANT_ID: string
  readonly VITE_STORAGE_ACCOUNT?: string
  readonly VITE_TABLE_SAS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
