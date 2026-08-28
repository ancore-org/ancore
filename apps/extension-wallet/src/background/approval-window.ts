import { DASHBOARD_SETTINGS_STORAGE_KEY } from '../state/dashboard-settings';
import { getChromeLocalStorage } from './chrome-storage';
import { enqueueApproval } from './handlers/external/response-queue';

type ChromeSidePanel = {
  setOptions(options: { path?: string; enabled?: boolean; tabId?: number }): Promise<void>;
  open(options: { tabId?: number; windowId?: number }): Promise<void>;
};

type ApprovalRoute =
  | 'grant-access'
  | 'sign-transaction'
  | 'sign-auth-entry'
  | 'request-session-key';
type ApprovalUxPreference = 'sidePanel' | 'popup';

const DEFAULT_APPROVAL_UX: ApprovalUxPreference = 'sidePanel';

function hasSidePanel(): boolean {
  return typeof chrome !== 'undefined' && 'sidePanel' in chrome;
}

function parseApprovalUxPreference(raw: unknown): ApprovalUxPreference {
  if (typeof raw !== 'string') return DEFAULT_APPROVAL_UX;

  try {
    const parsed = JSON.parse(raw) as { state?: { approvalUx?: unknown }; approvalUx?: unknown };
    const value = parsed.state?.approvalUx ?? parsed.approvalUx;
    return value === 'popup' || value === 'sidePanel' ? value : DEFAULT_APPROVAL_UX;
  } catch {
    return DEFAULT_APPROVAL_UX;
  }
}

async function getApprovalUxPreference(): Promise<ApprovalUxPreference> {
  const raw = await getChromeLocalStorage(DASHBOARD_SETTINGS_STORAGE_KEY);
  return parseApprovalUxPreference(raw);
}

function buildApprovalUrl(
  base: 'popup' | 'sidepanel',
  route: ApprovalRoute,
  requestId: string
): string {
  const encodedRequestId = encodeURIComponent(requestId);
  const routePath = route === 'sign-transaction' ? '' : `&route=${route}`;
  return `${base}/index.html?requestId=${encodedRequestId}${routePath}`;
}

async function openPopupApproval(route: ApprovalRoute, requestId: string): Promise<void> {
  await chrome.windows.create({
    url: buildApprovalUrl('popup', route, requestId),
    type: 'popup',
    width: 360,
    height: 600,
  });
}

async function openSidePanelApproval(route: ApprovalRoute, requestId: string): Promise<boolean> {
  if (!hasSidePanel()) return false;

  const sidePanel = chrome.sidePanel as ChromeSidePanel;
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const tab = tabs[0];

  if (!tab?.id) return false;

  await sidePanel.setOptions({
    tabId: tab.id,
    path: buildApprovalUrl('sidepanel', route, requestId),
    enabled: true,
  });
  await sidePanel.open({ tabId: tab.id });
  return true;
}

export async function openApprovalWindow(
  requestId: string,
  route: ApprovalRoute = 'sign-transaction'
): Promise<void> {
  const approvalUx = await getApprovalUxPreference();

  if (approvalUx === 'sidePanel' && (await openSidePanelApproval(route, requestId))) {
    return;
  }

  await openPopupApproval(route, requestId);
}

export async function openMockApproval(): Promise<void> {
  const requestId = crypto.randomUUID();
  enqueueApproval(requestId, 'https://example-dapp.com', 'signTransaction', {
    xdr: 'AAAAAgAAAAA=',
    network: 'testnet',
    smartAccountId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  });
  await openApprovalWindow(requestId, 'sign-transaction');
}
