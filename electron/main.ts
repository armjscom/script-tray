/**
 * 
 * @author Matthew Evans
 * @module script_tray
 * @see README.md
 * @copyright MIT see LICENSE.md
 * 
 */

import { execSync } from 'node:child_process'
import path from 'node:path'

import { app, dialog, ipcMain, BrowserWindow, Menu, MenuItem, Tray } from 'electron'
import AutoLaunch from 'auto-launch'

import { appInfo } from './appInfo'
import { appSettings } from './appSettings'
import { ScriptBuffer } from './ScriptBuffer'
import { Resolver } from './Resolver'

const autoLauncher = new AutoLaunch({ name: 'script_tray' })
const resBuff = new ScriptBuffer()
const resolveInputWin = new Resolver()
appSettings.config()
resBuff.size = appSettings.bufferSize

//  Verify auto launch is enabled if it should be
autoLauncher.isEnabled().then((enabled) => {
  if (enabled) return
  if (appSettings.startup) autoLauncher.enable()
}).catch((error:any) => {
  dialog.showErrorBox(`${appInfo.name}`,
    `Error enabling auto launcher!\n\n` +
    `${error.message}`)
})

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
      preload: path.join(__dirname, '../dist-electron/preload.js'),
    }
  })
  bufferWin.webContents.on('did-finish-load', () => {
    bufferWin?.webContents.send('send-buffer-data', resBuff.read())
  })
  //Add a trigger buffer update
  //bufferWin.webContents.send('send-buffer-data', resBuff.read())
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
    width: 900,
    height: 700,
    fullscreen: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../dist-electron/preload.js'),
    }
  })
  settingsWin.webContents.on('did-finish-load', () => {
    settingsWin?.webContents.send('send-settings-data', appSettings.getJSON())
  })
  settingsWin.on('close', (_event) => {
    settingsWin?.destroy()
  })
  {(process.env.VITE_DEV_SERVER_URL) ?
    settingsWin.loadURL('http://localhost:5174/html/settings.html') :
    settingsWin.loadFile(path.join(__dirname, '../dist/html/settings.html'))}
}

/* Event handler for receiving settings */
ipcMain.on('save-settings-data', async (_event, data) => {
  if (appSettings.getJSON() !== data) {
    if (dialog.showMessageBoxSync(<BrowserWindow>settingsWin, {
      type: 'question',
      title: `${appInfo.name} - Confirm`,
      buttons: ['Yes', 'No'],
      message: 'Save changes?'
    }) === 0) {
      appSettings.setJSON(data)
      resBuff.size = appSettings.bufferSize
      appSettings.save()
      appTray?.setContextMenu(buildMenu())
    }
  }
})

/* Event handler for resetting settings */
ipcMain.on('reset-settings-data', async () => {
  if (dialog.showMessageBoxSync({
    type: 'question',
    title: `${appInfo.name} - Confirm`,
    buttons: ['Yes', 'No'],
    message: 'Are you sure you want to reset settings?'
  }) === 0) {
    appSettings.reset()
    settingsWin?.webContents.send('send-settings-data', appSettings.getJSON())
    appTray?.setContextMenu(buildMenu())
  }
})

/** Window for argument input */
const inputWindow = (data:InputPromptData):void => {
  inputWin = new BrowserWindow({
    icon: appInfo.icon,
    title: `${appInfo.name} - ${data.command} ${data.argument}`,
    width: 400,
    height: 100,
    fullscreen: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../dist-electron/preload.js'),
    }
  })
  inputWin.on('close', (_event) => {
    resolveInputWin.reject('winCanceledEvent')
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
     * @param item Menu item calling the run
     * @param cmd Command to run
     */
    const CommandRunner = (cmd:string, item:TrayCommand):void => {
      try {
        const cmdRes = execSync(cmd, { windowsHide: item.showConsole })
        resBuff.write(`Command:  ${cmd}\n${cmdRes.toString()}`)
      } catch (error:any) {
        dialog.showErrorBox(`${appInfo.name} - ${item.command}`,
          `Command:  ${cmd}\nError:  ${error.message}`)
        resBuff.write(`Command:  ${cmd}\nError:  ${error.message}`)
      }
    }

    /**
     * Async version of forEach
     * @param array Array of items
     * @param callback Callback to run on each item
     */
    const asyncForEach = async (array:Array<any>, callback:Function):Promise<void> => {
      for (let index = 0; index < array.length; index++)
        await callback(array[index], index, array)
    }

    collection.forEach((item:any) => {
      if (item.label !== undefined &&
          item.sub !== undefined &&
          Array.isArray(item.sub)) {  //  Item is a sub menu
        const tempMenu = new Menu()
        buildLauncher(tempMenu, item.sub)  //  Recursive call to keep building menus
        //  Add the generated sub menu
        menu.append(new MenuItem({ label: item.label, submenu: tempMenu}))
        return  //  Next item
      }
      if (item.separator !== undefined) {  //  Item is a seperator
        menu.append(new MenuItem({ type: 'separator' }))
        return  //  Next item
      }
      if (item.label !== undefined &&
          item.cmd !== undefined &&
          item.args !== undefined &&
          item.showConsole !== undefined) {  //  Item is a command
        menu.append(new MenuItem({
          label: item.label,
          click: () => {
            if (item.args === undefined) CommandRunner(<string>item.cmd, item)
            else {
              (async () => {
                let runCanceled:boolean = false
                let runCmd:string = <string>item.cmd
                await asyncForEach(<Array<string>>item.args, async (arg:string) => {
                  inputWindow({ command: <string>item.cmd, argument: arg })
                  await resolveInputWin.promise.then(resStr => {
                    runCmd += ' ' + resStr
                  }).catch(_res => { runCanceled = true })
                })
                if (runCanceled) {
                  dialog.showMessageBox({
                    type: 'info',
                    title: appInfo.name,
                    message: `Command '${item.label}' canceled!`,
                    detail: `Command:  ${item.cmd}`,
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
      dialog.showErrorBox(`${appInfo.name}`,
        `Error building menu, incorrect menu item!\n\n` +
        `${Object.keys(item)}\n${Object.values(item)}`)
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
app.whenReady().then(async () => {
  appTray = new Tray(appInfo.icon)
  appTray.setToolTip(appInfo.name)
  appTray.setTitle(appInfo.name)
  appTray.setContextMenu(buildMenu())
})
