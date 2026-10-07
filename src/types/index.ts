export type FileType = 'pdf' | 'xlsx' | 'docx' | 'pptx';

export interface DocFile {
  id: string;
  name: string;
  type: FileType;
  size: string;
  modified: string;
  source: 'Cached' | 'ReadOnly' | 'Dropbox' | 'Google Drive' | 'Local Storage' | 'Device Storage';
  status: 'Signed' | 'Protected' | 'Synced' | 'v3.4' | 'Certified' | 'Device';
  statusColor?: string;
  pageCount?: number;
  selected?: boolean;
  data?: Uint8Array | ArrayBuffer;
  url?: string;
  folder?: 'Downloads' | 'Documents' | 'Scans' | 'Books';
  favorite?: boolean;
  lastReadPage?: number;
  lastOpenedAt?: number;
}

export interface SheetRow {
  rowNum: number;
  category: string;
  shipped: string;
  shippedNum: number;
  revenue: string;
  revenueNum: number;
  yoy: string;
  status: 'Completed' | 'On Track' | 'Pending';
}

export type ReaderTheme = 'light' | 'sepia' | 'night';

export interface ViewModeSettings {
  viewMode: 'single' | 'continuous';
  reflow: boolean;
  reflowFontSize: number;
  theme: ReaderTheme;
  readingDirection: 'horizontal' | 'vertical';
}

export interface Annotation {
  id: string;
  title: string;
  text: string;
  author: string;
  date: string;
  type: 'legal' | 'metric' | 'compliance';
}
