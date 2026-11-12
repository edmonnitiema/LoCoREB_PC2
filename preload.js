/* Pont entre l'application (index.html) et Windows : enregistrement et ouverture des fichiers */
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('Pont', {
  desktop: true,
  enregistrer: (name, type, b64, dossier, titre) => ipcRenderer.invoke('pont:enregistrer', name, type, b64, dossier || '', titre || ''),
  ouvrir: (chemin) => ipcRenderer.invoke('pont:ouvrir', chemin)
});
