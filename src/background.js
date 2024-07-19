'use strict';

import { Client } from "../node_modules/@gopeed/rest";

const Settings = {
  host: 'http://localhost:39666',
  token: 'qwqowo',
  enabled: true,
}

let client;

const initStorage = browser.storage.local.get().then((items) => {
  Object.assign(Settings, items);
  client = new Client({
    host: Settings.host,
    token: Settings.token
  });
});

browser.storage.onChanged.addListener((changes) => {
  if (changes.host) {
    Settings.host = changes.host.newValue;
  }
  if (changes.token) {
    Settings.token = changes.token.newValue;
  }
  if (changes.enabled) {
    Settings.enabled = changes.enabled.newValue;
  }
  client = new Client({
    host: Settings.host,
    token: Settings.token
  });
});

const INFOCOLOR = '#6699FF';
const ERRORCOLOR = '#FF3366';

browser.downloads.onCreated.addListener(async function (item) {
  await initStorage;
  if (!Settings.enabled) {
    return;
  }
  await browser.downloads.cancel(item.id);
  const filename = item.filename.split(/[\/\\]/).pop();
  try {
    const downloadUrl = item.url;
    await client.createTask({
      req: {
        url: downloadUrl,
        extra: {
          header: {
            "Referer": item.referrer || item.url || downloadUrl,
          }
        },
      },
      opt: {
        name: filename.split(/[\/\\]/).pop(),
      }
    });
    browser.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      browser.tabs.sendMessage(tabs[0].id, {
        action: 'showNotification',
        message: `正在下载: ${filename}`,
      })
    });
  } catch (error) {
    browser.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      browser.tabs.sendMessage(tabs[0].id, {
        action: 'showNotification',
        message: `下载${filename}失败: ${error.message}`,
        color: ERRORCOLOR,
        timeout: 4000,
      })
    });
  }
});

await browser.menus.removeAll();
browser.menus.create({
  id: "createTask",
  title: '使用Gopeed下载',
  contexts: ['link', 'image', 'video', 'audio'],
});

browser.menus.onClicked.addListener(async function (info, tab) {
  await initStorage;

  let downloadUrl = info.linkUrl || info.srcUrl || info.frameUrl;
  if (info.mediaType) {
    downloadUrl = info.frameUrl || downloadUrl;
  }
  if (!downloadUrl) {
    browser.tabs.sendMessage(tab.id, {
      action: 'showNotification',
      message: '下载失败, 无法获取下载链接',
      color: ERRORCOLOR,
    })
    return;
  }
  browser.tabs.sendMessage(tab.id, {
    action: 'showNotification',
    message: '正在获取下载链接...',
    color: INFOCOLOR,
    timeout: 1500,
  })
  try {
    const resolveResult = await client.resolve({
      url: downloadUrl,
      extra: {
        header: {
          "Referer": tab.url || downloadUrl,
        }
      }
    })
    await client.createTask({
      rid: resolveResult.id,
      opt: {
        name: resolveResult.res.files[0].name
      }
    })
    browser.tabs.sendMessage(tab.id, {
      action: 'showNotification',
      message: `正在下载: ${resolveResult.res.files[0].name}, 文件大小: ${(resolveResult.res.files[0].size / (1024 * 1024)).toFixed(2)}MB`,
    })
  } catch (error) {
    browser.tabs.sendMessage(tab.id, {
      action: 'showNotification',
      message: `下载${downloadUrl}失败: ${error.message}`,
      color: ERRORCOLOR,
      timeout: 4000,
    })
  }
});