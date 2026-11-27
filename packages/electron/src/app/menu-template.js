const { ipcMain } = require('electron');

const template = [
  {
    label: 'Application',
    submenu: [
      {
        label: 'Quit',
        click() {
          ipcMain.emit('main:start-quit-flow');
        }
      },
      {
        label: 'Force Quit',
        click() {
          process.exit();
        }
      }
    ]
  },
  {
    label: 'View',
    submenu: [{ role: 'toggledevtools' }]
  },
  {
    role: 'window',
    submenu: [{ role: 'minimize' }, { role: 'close' }]
  }
];

module.exports = template;
