/**
 * 
 * @author Matthew Evans
 * @module script_tray
 * @see README.md
 * @copyright MIT see LICENSE.md
 * 
 */

import { ipcRenderer, contextBridge } from 'electron'

contextBridge.exposeInIsolatedWorld(4201, 'bufferAPI', {
  onUpdateBuffer: (callback:Function):void => {
    ipcRenderer.on('send-buffer-data', (_event, value) => callback(value))
  }
})

contextBridge.exposeInMainWorld('settingsAPI', {
  saveSettings: (data:JSON):void => {
    ipcRenderer.send('save-settings-data', data)
  },
  resetSettings: ():void => {
    ipcRenderer.send('reset-settings-data', true)
  },
  onUpdateSettings: (callback:Function):void => {
    ipcRenderer.on('send-buffer-data', (_event, value) => callback(value))
  }
})

contextBridge.exposeInMainWorld('inputAPI', {
  //
})