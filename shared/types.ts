export type ThemeMode = "dark" | "light";
export type Language = "zh" | "en";

export type AuthState = {
  authenticated: boolean;
  twoFactorRequired: boolean;
};

export type AppSettings = {
  managementPasswordSet: boolean;
  twoFactorEnabled: boolean;
  theme: ThemeMode;
  language: Language;
};

export type CredentialKind = "password" | "privateKey";

export type ServerProfile = {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  credentialKind: CredentialKind;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  createdAt: string;
  updatedAt: string;
};

export type ServerMetrics = {
  cpuPercent: number;
  memory: UsageStat;
  swap: UsageStat;
  disk: UsageStat;
  updatedAt: string;
};

export type UsageStat = {
  used: number;
  total: number;
  percent: number;
};

export type ProcessInfo = {
  pid: number;
  user: string;
  cpu: number;
  memory: number;
  command: string;
};

export type CommandHistoryEntry = {
  id: string;
  command: string;
  profileId: string | null;
  profileName: string;
  host: string | null;
  username: string | null;
  createdAt: string;
};

export type RemoteFile = {
  name: string;
  path: string;
  size: number;
  type: "file" | "directory";
  modifiedAt: string;
};

export type TerminalMessage =
  | { type: "hello"; profileId: string }
  | { type: "input"; data: string }
  | { type: "resize"; cols: number; rows: number }
  | { type: "output"; data: string }
  | { type: "metrics"; metrics: ServerMetrics; processes: ProcessInfo[] }
  | { type: "error"; message: string }
  // SFTP — client → worker
  | { type: "sftp-ls"; requestId: string; path: string }
  | { type: "sftp-read"; requestId: string; path: string }
  | { type: "sftp-write"; requestId: string; path: string; content: string }
  | { type: "sftp-upload"; requestId: string; path: string; chunk: string; offset: number; done: boolean }
  | { type: "sftp-download"; requestId: string; path: string }
  // SFTP — worker → client
  | { type: "sftp-ls-result"; requestId: string; files: RemoteFile[] }
  | { type: "sftp-read-result"; requestId: string; path: string; content: string }
  | { type: "sftp-write-result"; requestId: string; ok: boolean }
  | { type: "sftp-upload-progress"; requestId: string; offset: number; done: boolean }
  | { type: "sftp-download-chunk"; requestId: string; chunk: string; done: boolean }
  | { type: "sftp-error"; requestId: string; message: string };
