export type IshikawaCategory = 'Man' | 'Machine' | 'Method' | 'Material' | 'Measurement' | 'Environment';

export type SeverityLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export type InterviewStage =
  | 'ProcessWalkthrough'
  | 'Difficulties'
  | 'Complaints'
  | 'RootCauses'
  | 'Suggestions'
  | 'Recap';

export type FindingStatus = 'Pending' | 'Confirmed' | 'Edited' | 'Disputed';

export interface UserProfile {
  userId: string;
  displayName: string;
  photoURL?: string;
  department: string;
  role: string;
  jobFunction: string;
  yearsInRole: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuditSession {
  sessionId: string;
  userId: string;
  stage: InterviewStage;
  selectedAuditAreaIds: string[];
  selectedAuditAreaNames?: string[];
  status: 'active' | 'completed';
  summary?: string;
  userDisplayName?: string;
  userDepartment?: string;
  userRole?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatInteraction {
  interactionId: string;
  sessionId: string;
  userId: string;
  role: 'user' | 'agent';
  content: string;
  modelUsed?: string;
  timestamp: string;
}

export interface AuditFinding {
  findingId: string;
  sessionId: string;
  userId: string;
  department?: string;
  processArea: string;
  ishikawaCategory: IshikawaCategory;
  severity: SeverityLevel;
  description: string;
  userQuote: string;
  suggestedImprovement: string;
  relatedStandard?: string;
  status: FindingStatus;
  userEditNote?: string;
  userDisputeReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditArea {
  id?: string;
  areaId: string;
  name: string;
  department: string;
  description: string;
  standards: string[];
  kpis: string[];
  sourceExcerpt?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyBaseline {
  id?: string;
  baselineId: string;
  title: string;
  sourceName: string;
  chunkIndex: number;
  totalChunks: number;
  textChunk: string;
  uploadedBy: string;
  createdAt: string;
}

export interface AuditReport {
  id?: string;
  reportId: string;
  title: string;
  totalFindingsAnalyzed: number;
  computedStats?: any;
  summary: string;
  fullMarkdown: string;
  generatedBy: string;
  createdAt: string;
  generatedAtPh?: string;
}

export interface MeResponse {
  uid: string;
  email: string;
  displayName?: string;
  isAdmin: boolean;
  adminSetupNeeded: boolean;
  roleDocPath: string;
}
