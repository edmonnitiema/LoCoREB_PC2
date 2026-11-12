/* LoCoREB pour Windows : enveloppe Electron autour de index.html (application hors ligne) */
const { app, BrowserWindow, Menu, dialog, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

app.setName('LoCoREB'); /* nom fixe : les données saisies restent au même endroit après chaque mise à jour */

let fenetre = null;

const nomSur = (t) => String(t || '').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim() || 'fichier';

function cheminLibre(chemin) {
  if (!fs.existsSync(chemin)) return chemin;
  const p = path.parse(chemin);
  for (let i = 2; i < 1000; i++) {
    const essai = path.join(p.dir, p.name + ' (' + i + ')' + p.ext);
    if (!fs.existsSync(essai)) return essai;
  }
  return chemin;
}

/* Enregistrement des fichiers : avec « dossier » -> Documents\LoCoREB\<dossier> (créé si besoin) ; sinon boîte « Enregistrer sous » */
ipcMain.handle('pont:enregistrer', async (ev, name, type, b64, dossier, titre) => {
  try {
    const contenu = Buffer.from(String(b64 || ''), 'base64');
    const nom = nomSur(name);
    if (dossier) {
      const dir = path.join(app.getPath('documents'), 'LoCoREB', nomSur(dossier));
      fs.mkdirSync(dir, { recursive: true });
      const chemin = cheminLibre(path.join(dir, nom));
      fs.writeFileSync(chemin, contenu);
      return { chemin: chemin, dossierChemin: dir };
    }
    const ext = path.extname(nom).replace('.', '').toLowerCase();
    const choix = await dialog.showSaveDialog(BrowserWindow.fromWebContents(ev.sender), {
      title: titre || 'Enregistrer sous',
      defaultPath: path.join(app.getPath('documents'), nom),
      filters: ext ? [{ name: ext.toUpperCase(), extensions: [ext] }, { name: 'Tous les fichiers', extensions: ['*'] }] : [{ name: 'Tous les fichiers', extensions: ['*'] }]
    });
    if (choix.canceled || !choix.filePath) return { annule: true };
    fs.writeFileSync(choix.filePath, contenu);
    return { chemin: choix.filePath };
  } catch (err) {
    return { repli: true, erreur: String((err && err.message) || err) };
  }
});

ipcMain.handle('pont:ouvrir', async (ev, chemin) => {
  try {
    if (typeof chemin !== 'string' || !chemin) return { ok: false };
    const erreur = await shell.openPath(chemin);
    return { ok: !erreur, erreur: erreur || '' };
  } catch (err) {
    return { ok: false, erreur: String((err && err.message) || err) };
  }
});

function creerFenetre() {
  fenetre = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#ffffff',
    title: 'LoCoREB',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  fenetre.once('ready-to-show', () => { fenetre.maximize(); fenetre.show(); });
  fenetre.loadFile(path.join(__dirname, 'index.html'));
  /* les liens externes s'ouvrent dans le navigateur, jamais dans l'application */
  fenetre.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  fenetre.webContents.on('will-navigate', (e, url) => {
    if (!/^file:/i.test(url)) {
      e.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });
  fenetre.on('closed', () => { fenetre = null; });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (fenetre) {
      if (fenetre.isMinimized()) fenetre.restore();
      fenetre.focus();
    }
  });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    creerFenetre();
  });
  app.on('window-all-closed', () => app.quit());
}
