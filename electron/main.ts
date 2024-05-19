/**
 * 
 * @author Matthew Evans
 * @module script-tray
 * @see README.md
 * @copyright MIT see LICENSE.md
 * 
 */

import { exec } from 'node:child_process'
import path from 'node:path'

import { app, dialog, ipcMain, BrowserWindow, Menu, MenuItem, Tray } from 'electron'
import AutoLaunch from 'auto-launch'
import { asyncForEach } from '@spongex/async-for-each'
import { AsyncResolver } from '@spongex/async-resolver'

import { appInfo } from './appInfo'
import { AppSettings } from './lib/AppSettings'
import { ScriptBuffer } from './lib/ScriptBuffer'

let loadTrayData:boolean = true
process.argv.forEach(arg => {
  if(arg === '--no-load-traydata') loadTrayData = false
})

const __locale = Intl.DateTimeFormat().resolvedOptions().locale

const autoLauncher:AutoLaunch = new AutoLaunch({ name: 'script_tray' })
const appSettings:AppSettings = new AppSettings(loadTrayData)
const resBuff:ScriptBuffer = new ScriptBuffer(appSettings.bufferSize)
let resolveInputWin:AsyncResolver = new AsyncResolver()

//  Windows & tray objects
let bufferWin:BrowserWindow | null
let settingsWin:BrowserWindow | null
let inputWin:BrowserWindow | null
let appTray:Tray | null

/** Window for output buffer */
const bufferWindow = ():void => {
  bufferWin = new BrowserWindow({
    icon: appInfo.icon,
    title: `${appInfo.name} - Output Buffer`,
    width: 800,
    height: 600,
    fullscreen: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: false,
      preload: path.join(__dirname, '../dist-electron/preload.js'),
    }
  })
  bufferWin.webContents.on('did-finish-load', () => {
    bufferWin?.webContents.send('send-buffer-data', resBuff.read())
  })

  //  Send when the buffer updates
  resBuff.on('script-buffer-updated', () => {
    bufferWin?.webContents.send('send-buffer-data', resBuff.read())
  })
  resBuff.on('error', (error:any) => {
    dialog.showErrorBox(`${appInfo.name}`, `Buffer Event Error:  ${error.message}`)
  })

  bufferWin.on('close', (_event) => {
    bufferWin?.destroy()
  })
  {(process.env.VITE_DEV_SERVER_URL) ?
    bufferWin.loadURL(path.posix.join(process.env.VITE_DEV_SERVER_URL, 'html/buffer.html')) :
    bufferWin.loadFile(path.join(__dirname, '../dist/html/buffer.html'))}
}

/** Window for editing settings */
const settingsEditorWindow = ():void => {
  settingsWin = new BrowserWindow({
    icon: appInfo.icon,
    title: `${appInfo.name} - Settings`,
    width: 940,
    height: 740,
    fullscreen: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: false,
      preload: path.join(__dirname, '../dist-electron/preload.js'),
    }
  })
  settingsWin.webContents.on('did-finish-load', () => {
    settingsWin?.webContents.send('send-settings-data', appSettings.getData())
  })
  settingsWin.on('close', (_event) => {
    settingsWin?.destroy()
    if (loadTrayData) appSettings.load()
  })
  {(process.env.VITE_DEV_SERVER_URL) ?
    settingsWin.loadURL('http://localhost:5174/html/settings.html') :
    settingsWin.loadFile(path.join(__dirname, '../dist/html/settings.html'))}
}

/* Event handler for saving settings */
ipcMain.on('save-settings-data', (_event, data) => {
  if (dialog.showMessageBoxSync(<BrowserWindow>settingsWin, {
    type: 'question',
    title: `${appInfo.name} - Confirm`,
    buttons: [ 'Yes', 'No' ],
    message: 'Do you want to save changes?'
  }) === 0) {
    if(appSettings.setData(data)) {
      appSettings.save()
      resBuff.size = appSettings.bufferSize
      {(appSettings.startup) ? autoLauncher.enable() : autoLauncher.disable() }
      appTray?.setContextMenu(buildMenu())
      settingsWin?.webContents.send('send-settings-data', appSettings.getData())
    }
  }
})

/* Event handler for resetting settings */
ipcMain.on('reset-settings-data', (_event, data) => {
  if (!data) return  //  Data should be 'true'
  if (dialog.showMessageBoxSync(<BrowserWindow>settingsWin, {
    type: 'question',
    title: `${appInfo.name} - Confirm`,
    buttons: [ 'Yes', 'No' ],
    message: 'Are you sure you want to reset settings?'
  }) === 0) {
    appSettings.reset()
    settingsWin?.webContents.send('send-settings-data', appSettings.getData())
  }
})

/** Window for argument input */
const inputWindow = (data:InputPromptData):void => {
  resolveInputWin = new AsyncResolver()
  inputWin = new BrowserWindow({
    icon: appInfo.icon,
    title: `${appInfo.name} - ${data.label}: ${data.argument}`,
    width: 400,
    height: 128,
    fullscreen: false,
    fullscreenable: false,
    resizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: false,
      preload: path.join(__dirname, '../dist-electron/preload.js'),
    }
  })
  inputWin.on('close', (_event) => {
    resolveInputWin.reject(true)
    inputWin?.destroy()
  })
  inputWin.webContents.on('did-finish-load', () => {
    inputWin?.webContents.send('send-input-data', data)
  })
  {(process.env.VITE_DEV_SERVER_URL) ?
    inputWin.loadURL('http://localhost:5175/html/arg-input.html') :
    inputWin.loadFile(path.join(__dirname, '../dist/html/arg-input.html'))}
}

/* Event handler for receiving data from the input box */
ipcMain.on('recieve-input-data', (_event, data) => {
  resolveInputWin.resolve(data)
  inputWin?.destroy()
})

/** About message box */
const aboutMessageBox = ():void => {
  dialog.showMessageBox({
    type: 'info',
    title: `About ${appInfo.name}`,
    message: `${appInfo.name}\nVersion:  ${appInfo.version}`,
    detail:
      `Author:  ${appInfo.author}\n` +
      `${appInfo.websiteURL}\n\n` +
      `License:  ${appInfo.license}\n` +
      `${appInfo.licenseURL}\n\n\n` +
      `Icon:  ${appInfo.iconURL}\n` +
      `License:  ${appInfo.iconLicenseURL}`,
    icon: appInfo.icon
  })
}

/** Builds the system tray menu */
const buildMenu = ():Menu => {
  /**
   * Build the main menu part
   * @param menu Menu item to append to
   */
  const buildMain = (menu:Menu):void => {
    menu.append(new MenuItem({ type: 'separator' }))
    menu.append(new MenuItem({
      label: `Show Output Buffer`,
      click: () => { bufferWindow() }
    }))
    menu.append(new MenuItem({ type: 'separator' }))
    menu.append(new MenuItem({ label: 'Settings',
      click: () => { settingsEditorWindow() }
    }))
    menu.append(new MenuItem({ type: 'separator' }))
    menu.append(new MenuItem({
      label: `About ${appInfo.name}`,
      click: () => { aboutMessageBox() }
    }))
    menu.append(new MenuItem({ label: `Close ${appInfo.name}`, role: 'quit' }))
  }

  /**
   * Build the launcher menu part
   * @param menu Menu item to append to
   * @param collection Menu items to process
   */
  const buildLauncher = (menu:Menu, collection:Array<any>):void => {
    /**
     * Function to run a command
     * @param cmd Command to run
     * @param item Menu item calling the run
     */
    const CommandRunner = (cmd:string, item:TrayCommand):void => {
      const startDate = new Date().toLocaleString(__locale, { timeZoneName: 'short' })
      const startTime = performance.now()
      exec(cmd, { windowsHide: true }, (error, stdout, stderr) => {
        const endTime = performance.now()
        const endDate = new Date().toLocaleString(__locale, { timeZoneName: 'short' })
        if(error) {
          dialog.showErrorBox(`${appInfo.name} - ${item.command}`,
            `Command:  ${cmd}\nError:  ${error.message}`)
        }
        resBuff.emit('script-buffer-write', {
          command: cmd,
          start: startDate,
          stop: endDate,
          duration: (endTime - startTime).toFixed(3),
          out: stdout,
          err: stderr
        })
      })
    }

    collection.forEach((item:any) => {
      //  Item is a sub menu
      if (item.label !== undefined && item.label !== '' &&
          item.sub !== undefined && Array.isArray(item.sub)) {
        const tempMenu = new Menu()
        buildLauncher(tempMenu, item.sub)  //  Build submenu
        menu.append(new MenuItem({ label: item.label, submenu: tempMenu}))
        return  //  Next item
      }
      //  Item is a seperator
      if (item.separator !== undefined && item.separator === null) {
        menu.append(new MenuItem({ type: 'separator' }))
        return  //  Next item
      }
      //  Item is a command
      if (item.label !== undefined && item.label !== '' &&
          item.command !== undefined && item.command !== '' &&
          item.args !== undefined && Array.isArray(item.args) &&
          item.showConsole !== undefined) {
        menu.append(new MenuItem({
          label: item.label,
          click: () => {
            if (item.args.length === 0) CommandRunner(<string>item.command, item)
            else {
              (async () => {
                let runCanceled:boolean = false
                let runCmd:string = <string>item.command
                await asyncForEach(<Array<string>>item.args, async (arg:string) => {
                  inputWindow({ label: <string>item.label, argument: arg })
                  await resolveInputWin.promise.then(resStr => {
                    runCmd += ' ' + resStr
                  }).catch(res => { runCanceled = res })
                })
                if (runCanceled) {
                  dialog.showMessageBox({
                    type: 'info',
                    title: appInfo.name,
                    message: `Command '${item.label}' canceled!`,
                    detail: `Command:  ${item.command}`,
                    icon: appInfo.icon
                  })
                } else CommandRunner(runCmd, item)
              })()
            }
          }
        }))
        return  //  Next item
      }
      //  Item wasn't processed, so there's a problem with the format
      let outErrStr = `Error building menu, incorrect menu item!\n\n`
      for (let key in item) {
        if(item.hasOwnProperty(key)) outErrStr += `${key} - ${item[key]}\n`
      }
      dialog.showErrorBox(`${appInfo.name}`, outErrStr)
    })
  }

  /* Generate the complete menu */
  const menu = new Menu()
  buildLauncher(menu, appSettings.launchMenu)
  buildMain(menu)
  return menu
}

/* Close tray and windows on exit */
app.on('before-quit', () => {
  bufferWin?.destroy()
  settingsWin?.destroy()
  inputWin?.destroy()
  appTray?.destroy()
})

/* Make sure app doesn't quit when no windows are open */
app.on('window-all-closed', () => {})

/* Run Script Tray app */
app.whenReady().then(() => {
  //  Verify auto launch is enabled if it should be
  autoLauncher.isEnabled().then((enabled) => {
    if (enabled) return
    if (appSettings.startup) autoLauncher.enable()
  }).catch((error:any) => {
    dialog.showErrorBox(`${appInfo.name}`,
      `Error enabling auto launcher!\n\n` +
      `${error.message}`)
  })

  appTray = new Tray(appInfo.icon)
  appTray.setToolTip(appInfo.name)
  appTray.setTitle(appInfo.name)
  appTray.setContextMenu(buildMenu())
})
