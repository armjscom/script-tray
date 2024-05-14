/**
 * 
 * @author Matthew Evans
 * @module script_tray
 * @see README.md
 * @copyright MIT see LICENSE.md
 * 
 */

export class ScriptBuffer {
  #buffer:Array<string>
  #size:number

  static #minSize:number = 10
  static #maxSize:number = 500

  /**
   * Create a new ScriptBuffer object
   * @param size Size of the buffer
   */
  constructor(size = 100) {
    this.#buffer = []
    this.#size = this.#check(size)
  }

  /**
   * Read the script buffer
   * @returns The entire buffer formatted as a single string
   */
  read():string {
    let resStr = ''
    this.#buffer.forEach(str => resStr += `${str}\n`)
    return resStr
  }

  /**
   * Write to the script buffer
   * @param data Data to write
   */
  write(data:string):void {
    this.#buffer.push(data)
    this.#trim()
  }

  /** Trim the buffer to max size */
  #trim():void {
    if(this.#buffer.length > this.#size)
      this.#buffer = this.#buffer.slice(-this.#size)
  }

  /**
   * Check for valid buffer size
   * @param val Value to check
   * @returns Value adjusted if above max or below min
   */
  #check(val:number) {
    if(val < ScriptBuffer.#minSize) val = ScriptBuffer.#minSize
    if(val > ScriptBuffer.#maxSize) val = ScriptBuffer.#maxSize
    return val
  }

  /** Get the max buffer size */
  get size():number { return this.#size }

  /** Set the max buffer size and trim if necessary */
  set size(newSize:number) {
    this.#size = this.#check(newSize)
    this.#trim()
  }
}
