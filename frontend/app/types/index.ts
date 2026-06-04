export interface User {
  id: string;
  dateCreated?: string;
  email: string;
  displayName: string;
  roleName: string;
  avatarFilename?: string | null;
}

export type UserRole = 'ADMIN' | 'USER';

export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface AdminUser {
  id: string;
  dateCreated: string;
  email: string;
  displayName: string;
  roleId: number;
  status: UserStatus;
  roleName: UserRole;
  avatarFilename?: string | null;
}

export type AssetStatus = 'STOCK' | 'ASSIGNED' | 'MAINTENANCE' | 'ARCHIVED';

export type DepreciationMethod = 'STRAIGHT_LINE';

export interface AssetChildSummary {
  id: string;
  name: string;
  model: string;
  serialNumber: string;
  status: AssetStatus;
}

export interface Asset {
  id: string;
  dateCreated: string;
  dateUpdated: string;
  name: string;
  model: string;
  serialNumber: string;
  status: AssetStatus;
  assignedUserId: string | null;
  siteId: string | null;
  latitude: number | null;
  longitude: number | null;
  assignedUserName: string | null;
  assignedUserEmail: string | null;
  assignedUserAvatarFilename?: string | null;
  siteName: string | null;
  effectiveLatitude: number | null;
  effectiveLongitude: number | null;
  imageFilename?: string | null;
  note?: string | null;
  manufacturerId?: string | null;
  vendorId?: string | null;
  parentAssetId?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  customFields?: Record<string, unknown>;
  manufacturerName?: string | null;
  manufacturerImageFilename?: string | null;
  assignedAt?: string | null;
  vendorName?: string | null;
  parentAssetName?: string | null;
  childCount?: number;
  children?: AssetChildSummary[];
  purchaseDate?: string | null;
  purchaseCost?: number | null;
  salvageValue?: number | null;
  usefulLifeMonths?: number | null;
  depreciationMethod?: DepreciationMethod | null;
  monthlyDepreciation?: number | null;
  accumulatedDepreciation?: number | null;
  bookValue?: number | null;
  warrantyEndDate?: string | null;
  expectedReturnDate?: string | null;
  /** Admin asset detail URL encoded in QR codes (from FRONTEND_URL). */
  detailUrl?: string;
}

export interface Manufacturer {
  id: string;
  dateCreated: string;
  dateUpdated: string;
  name: string;
  imageFilename?: string | null;
  assetCount: number;
}

export interface Vendor {
  id: string;
  dateCreated: string;
  dateUpdated: string;
  name: string;
  imageFilename?: string | null;
  assetCount: number;
}

export interface ListManufacturersData {
  manufacturers: Manufacturer[];
  total: number;
  page: number;
  pageSize: number | null;
}

export type CategoryFieldType =
  | 'TEXT'
  | 'TEXTAREA'
  | 'NUMBER'
  | 'BOOLEAN'
  | 'DATE'
  | 'SELECT'
  | 'MULTI_SELECT';

export interface CategoryField {
  id: string;
  categoryId: string;
  fieldKey: string;
  label: string;
  dataType: CategoryFieldType;
  required: boolean;
  options: string[] | null;
  helpText: string | null;
  placeholder: string | null;
  unit: string | null;
  sortOrder: number;
}

/** A field as edited in the admin form (no id yet; key derived server-side). */
export interface CategoryFieldDraft {
  fieldKey?: string;
  label: string;
  dataType: CategoryFieldType;
  required: boolean;
  options: string[];
}

export interface Category {
  id: string;
  dateCreated: string;
  dateUpdated: string;
  name: string;
  icon: string | null;
  description: string | null;
  assetCount?: number;
  fieldCount?: number;
  fields?: CategoryField[];
}

export interface ListCategoriesData {
  categories: Category[];
  total: number;
  page: number;
  pageSize: number | null;
}

export interface ListVendorsData {
  vendors: Vendor[];
  total: number;
  page: number;
  pageSize: number | null;
}

export interface Site {
  id: string;
  dateCreated: string;
  dateUpdated: string;
  name: string;
  description: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  assetCount: number;
}

export interface ListAssetsData {
  assets: Asset[];
  total: number;
  page: number;
  pageSize: number;
}

/** GET /api/p/assets/map-markers — slim shape for the dashboard map. */
export interface AssetMapMarker {
  id: string;
  name: string;
  siteName: string | null;
  effectiveLatitude: number;
  effectiveLongitude: number;
}

export interface ListAssetMapMarkersData {
  markers: AssetMapMarker[];
}

/** GET /api/me/assets — fields used on home and my assets pages. */
export interface MyAssetListItem {
  id: string;
  name: string;
  model: string;
  serialNumber: string;
  status: AssetStatus;
  assignedAt: string | null;
  manufacturerId: string | null;
  manufacturerName: string | null;
  manufacturerImageFilename: string | null;
  siteName: string | null;
  effectiveLatitude: number | null;
  effectiveLongitude: number | null;
}

export interface ListMyAssetsData {
  assets: MyAssetListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListUsersData {
  users: AdminUser[];
  total: number;
  page: number;
  pageSize: number | null;
}

export interface ListSitesData {
  sites: Site[];
  total: number;
  page: number;
  pageSize: number | null;
}

export type HandoverType = 'CHECK_OUT' | 'CHECK_IN';
export type HandoverStatus = 'OPEN' | 'CONSUMED' | 'CANCELLED' | 'EXPIRED';

export interface Handover {
  id: string;
  dateCreated: string;
  assetId: string;
  type: HandoverType;
  status: HandoverStatus;
  targetUserId: string;
  createdByUserId: string | null;
  expiresAt: string;
  consumedAt: string | null;
  consumedByUserId: string | null;
  cancelledAt: string | null;
  cancelledByUserId: string | null;
  assetName: string;
  assetSerialNumber: string;
  assetImageFilename: string | null;
  targetUserName: string | null;
  targetUserEmail: string | null;
  targetUserAvatarFilename: string | null;
}

export interface ListHandoversData {
  handovers: Handover[];
  total: number;
}

export interface PendingHandover {
  id: string;
  type: HandoverType;
  expiresAt: string;
  assetId: string;
  assetName: string;
  assetSerialNumber: string;
}

export interface ListPendingHandoversData {
  handovers: PendingHandover[];
  total: number;
}

export type TransactionAction =
  | 'CREATED'
  | 'UPDATED'
  | 'ASSIGNED'
  | 'UNASSIGNED'
  | 'STATUS_CHANGED'
  | 'SITE_CHANGED'
  | 'MANUFACTURER_CHANGED'
  | 'VENDOR_CHANGED'
  | 'PARENT_CHANGED'
  | 'CATEGORY_CHANGED'
  | 'CUSTOM_FIELDS_CHANGED'
  | 'WARRANTY_CHANGED'
  | 'RETURN_DATE_CHANGED'
  | 'DELETED';

export type DataQualityIssue =
  | 'INACTIVE_USER_ASSIGNED'
  | 'ASSIGNED_WITHOUT_USER'
  | 'WARRANTY_EXPIRED'
  | 'WARRANTY_EXPIRING_SOON'
  | 'RETURN_OVERDUE'
  | 'RETURN_DUE_SOON';

export type DataQualitySeverity = 'high' | 'medium' | 'low';

export interface DataQualityRow {
  issue: DataQualityIssue;
  severity: DataQualitySeverity;
  assetId: string;
  assetName: string;
  serialNumber: string;
  assignedUserId: string | null;
  assignedUserName: string | null;
  assignedUserEmail: string | null;
  assignedUserAvatarFilename: string | null;
  detail: string | null;
}

export interface ListDataQualityData {
  rows: DataQualityRow[];
  total: number;
  page: number;
  pageSize: number | null;
}

export interface ListAlertsData {
  alerts: DataQualityRow[];
  total: number;
}

export interface AttentionCounts {
  inactiveUserAssignedCount: number;
  assignedWithoutUserCount: number;
  warrantyExpiredCount: number;
  warrantyExpiring30DaysCount: number;
  returnOverdueCount: number;
  returnDueSoon7DaysCount: number;
}

export interface Transaction {
  id: string;
  dateCreated: string;
  action: TransactionAction;
  assetId: string | null;
  assetName: string;
  assetImageFilename: string | null;
  actorUserId: string | null;
  actorName: string | null;
  actorAvatarFilename: string | null;
  targetUserId: string | null;
  targetName: string | null;
  targetAvatarFilename: string | null;
  detail: string | null;
}

export interface ListTransactionsData {
  transactions: Transaction[];
  total: number;
  page: number;
  pageSize: number;
}

/** GET /api/me/transactions — personal history table on the dashboard. */
export interface MyTransactionListItem {
  id: string;
  dateCreated: string;
  action: TransactionAction;
  assetId: string | null;
  assetName: string;
  assetImageFilename: string | null;
  detail: string | null;
}

export interface ListMyTransactionsData {
  transactions: MyTransactionListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DashboardStats {
  totals: {
    assets: number;
    sites: number;
    users: number;
    assignedAssets: number;
    manufacturers: number;
    vendors: number;
  };
  assetsByStatus: { status: AssetStatus; count: number }[];
  assetsBySite: { siteId: string | null; siteName: string | null; count: number }[];
  assetsByManufacturer: {
    manufacturerId: string | null;
    manufacturerName: string | null;
    count: number;
  }[];
  assetsByVendor: { vendorId: string | null; vendorName: string | null; count: number }[];
  attention: AttentionCounts;
}

export interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface SessionState {
  user: User | null;
  loading: boolean;
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration: number;
  /** Optional inline action button (e.g. "Undo"). */
  action?: { label: string; onClick: () => void };
}

export type Language = 'en' | 'es';

export interface ApiResponse<T = undefined> {
  statusCode: number;
  code: string;
  message: string;
  data?: T;
}

export interface LoginResponseData {
  token: string;
  user: User;
}

export interface PublicConfigData {
  signupEnabled: boolean;
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  capabilities: string[];
  ownerUserId: string | null;
  ownerEmail: string | null;
  ownerName: string | null;
  ownerAvatarFilename: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface ApiKeySecret {
  id: string;
  name: string;
  prefix: string;
  secret: string;
  capabilities: string[];
  expiresAt: string | null;
}

export interface ListApiKeysData {
  apiKeys: ApiKey[];
  total: number;
}

export interface ApiKeyData {
  apiKey: ApiKey;
}

export interface ApiKeySecretData {
  apiKey: ApiKeySecret;
}

export interface ApiAccessLogEntry {
  id: string;
  apiKeyId: string | null;
  userId: string | null;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number | null;
  ip: string | null;
  createdAt: string;
  keyName: string | null;
  userEmail: string | null;
}

export interface ListApiAccessLogData {
  logs: ApiAccessLogEntry[];
  total: number;
}

export interface NavItem {
  label: string;
  to: string;
}

export type WebhookPlatform = 'slack' | 'discord' | 'telegram';

export interface WebhookEvent {
  type: string;
  category: string;
  labelEn: string;
  labelEs: string;
  defaultSubscribed: boolean;
}

export interface WebhookDestination {
  id: string;
  name: string;
  platform: WebhookPlatform;
  platformIconUrl: string;
  enabled: boolean;
  targetHint: string;
  subscribedEvents: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ListWebhookEventsData {
  events: WebhookEvent[];
}

export interface ListWebhookDestinationsData {
  destinations: WebhookDestination[];
  total: number;
}

export interface WebhookDestinationData {
  destination: WebhookDestination;
}
