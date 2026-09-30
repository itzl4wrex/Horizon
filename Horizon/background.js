// Registers right-click context menu items that let you add a link or the
// current page straight to Horizon's quick links, from anywhere on the web.

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'horizon-add-link',
    title: 'Add link to Horizon quick links',
    contexts: ['link']
  });
  chrome.contextMenus.create({
    id: 'horizon-add-page',
    title: 'Add this page to Horizon quick links',
    contexts: ['page']
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  let url = null;
  if (info.menuItemId === 'horizon-add-link') url = info.linkUrl;
  else if (info.menuItemId === 'horizon-add-page') url = info.pageUrl;
  if (!url) return;

  chrome.storage.local.get({ horizon_pending_links: [] }, (result) => {
    const pending = result.horizon_pending_links || [];
    pending.push(url);
    chrome.storage.local.set({ horizon_pending_links: pending }, flashBadge);
  });
});

function flashBadge() {
  chrome.action.setBadgeText({ text: '✓' });
  chrome.action.setBadgeBackgroundColor({ color: '#b7dba1' });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 1800);
}

// Clicking the toolbar icon just opens a fresh Horizon tab.
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({});
});
