<!--
  script-tray
  By:  Matthew Evans
  See LICENSE.md
-->

<script setup lang="ts">
import { ref } from 'vue'
import type { ModelRef } from 'vue'

/** Model for the tray command reference  */
const _trayCommand:ModelRef<TrayCommand> = defineModel({ required: true })

/** Reference for displaying the duplicate variable command warning */
const _showCmdWarn = ref(false)

/** Check the command field to make sure multiple variable names are not used */
const checkCmd = () => {
  if (_trayCommand.value.command !== '') {
    const args = _trayCommand.value.command.match(/(?<=\?<\|)(.*?)(?=\|>)/g)
    if (args !== null) {
      args.forEach((arg, idx, array) => { array[idx] = arg.trim() })
      if ((new Set(args)).size !== args.length) _showCmdWarn.value = true
      else _showCmdWarn.value = false
    }
  }
}

/** Tooltip strings used in tray cmd display */
const _tooltips = {
  command: 'Enter running command\n\nTo prompt for input arguments, use the variable format:\n?<| varname |>',
  cwd: 'Current working directory'
}

/** Verify the current working directory */
const verifyCwd = () => {
  window.settingsAPI.verifyCwd(_trayCommand.value.cwd)
}
</script>

<template>
<section>
<table>
  <tr>
    <td><label for="cmdLabel">Label:</label></td>
    <td><input type="text" v-model="_trayCommand.label" id="cmdLabel"/></td>
  </tr>
  <tr>
    <td>
      <label for="cmdCommand" :title="_tooltips.command" data-toggle="tooltip">Command:</label>
    </td>
    <td>
      <input type="text" v-model="_trayCommand.command" @input="checkCmd" id="cmdCommand" :title="_tooltips.command" data-toggle="tooltip"/>
    </td>
  </tr>
  <tr v-show="_showCmdWarn" id="cmdWarn">
    <td colspan="2">Warning:  Duplicate variable names detected in command!</td>
  </tr>
  <tr>
    <td><label for="cmdCwd" :title="_tooltips.cwd" data-toggle="tooltip">CWD:</label></td>
    <td>
      <input type="text" v-model="_trayCommand.cwd" id="cmdCwd" :title="_tooltips.cwd" data-toggle="tooltip"/>
      <button @click="verifyCwd">Verify</button>
    </td>
  </tr>
</table>
</section>
</template>

<style lang="stylus" scoped>
table
  table-layout fixed
#cmdLabel
  width 200px
#cmdCommand
  width 320px
#cmdCwd
  width 200px
#cmdWarn
  color rgb(255, 0, 0)
  font-style italic
button
  vertical-align top
  font-size 0.6em
</style>
