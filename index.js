const { app, BrowserWindow } = require('electron');
const path = require('path');



// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1024,
    height: 600,
    icon: __dirname + '/favicon.png',
    webPreferences: {
      //https://stackoverflow.com/questions/37884130/electron-remote-is-undefined
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });

  //invoke updates
  require('update-electron-app')({
    repo: 'sulcgroup/oxdna-viewer',
    updateInterval: '1 hour',
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  global.sharedObject = {argv: process.argv.splice(1)}; //first arg is the name of the app so we remove it
  mainWindow.removeMenu();
  // adding optional scripting interface
  if(global.sharedObject.argv.includes('--js')){
    mainWindow.openDevTools();
  }
};



// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
