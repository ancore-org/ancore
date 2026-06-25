import { enqueueApproval } from './handlers/external/response-queue';

type ChromeSidePanel = {
  setOptions(options: { path?: string; enabled?: boolean }): Promise<void>;
  open(options: { windowId: number }): Promise<void>;
};

function hasSidePanel(): boolean {
  try {
    return 'sidePanel' in chrome;
  } catch {
    return false;
  }
}

export async function openApprovalWindow(requestId: string): Promise<void> {
  if (hasSidePanel()) {
    const sidePanel = chrome.sidePanel as ChromeSidePanel;
    await sidePanel.setOptions({
      path: `sidepanel/index.html?requestId=${requestId}`,
    });
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const tab = tabs[0];
    if (tab?.windowId) {
      await sidePanel.open({ windowId: tab.windowId });
    }
  } else {
    await chrome.windows.create({
      url: `popup/index.html?requestId=${requestId}`,
      type: 'popup',
      width: 360,
      height: 600,
    });
  }
}

export async function openMockApproval(): Promise<void> {
  const requestId = crypto.randomUUID();
  enqueueApproval(requestId, 'https://example-dapp.com', 'signTransaction', {
    xdr: 'AAAAAgAAAAA=',
    network: 'testnet',
    smartAccountId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  });
  await openApprovalWindow(requestId);
}
