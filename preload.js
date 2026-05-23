const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('moodleAuth', {
  captureCookie: (url, credentials) => ipcRenderer.invoke('open-moodle-login', url, credentials),
  downloadZIP: (url) => ipcRenderer.invoke('moodle-download-zip', url)
});

window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector);
    if (element) element.innerText = text;
  };

  for (const type of ['chrome', 'node', 'electron']) {
    replaceText(`${type}-version`, process.versions[type]);
  }
});
