/* @flow */

import {
  tip,
  toArray,
  hyphenate,
  formatComponentName,
  invokeWithErrorHandling
} from '../util/index'
import { updateListeners } from '../vdom/helpers/index'

export function initEvents (vm: Component) {
  vm._events = Object.create(null)
  vm._hasHookEvent = false
  // init parent attached events
  const listeners = vm.$options._parentListeners
  if (listeners) {
    updateComponentListeners(vm, listeners)
  }
}

let target: any

function add (event, fn) {
  target.$on(event, fn)
}

function remove (event, fn) {
  target.$off(event, fn)
}

function createOnceHandler (event, fn) {
  const _target = target
  return function onceHandler () {
    const res = fn.apply(null, arguments)
    if (res !== null) {
      _target.$off(event, onceHandler)
    }
  }
}

export function updateComponentListeners (
  vm: Component,
  listeners: Object,
  oldListeners: ?Object
) {
  target = vm
  updateListeners(listeners, oldListeners || {}, add, remove, createOnceHandler, vm)
  target = undefined
}

export function eventsMixin (Vue: Class<Component>) {
  const hookRE = /^hook:/
  Vue.prototype.$on = function (event: string | Array<string>, fn: Function): Component { //监听当前实例上的自定义事件。事件可以由vm.$emit触发。回调函数会接收所有传入事件触发函数的额外参数
    const vm: Component = this  //实例对象必须是vue实例
    if (Array.isArray(event)) { //event为数组
      for (let i = 0, l = event.length; i < l; i++) { //遍历event数组  为所有的自定义事件添加回调函数
        vm.$on(event[i], fn)
      }
    } else {
      (vm._events[event] || (vm._events[event] = [])).push(fn) //给vm._events添加一个当前的函数
      // optimize hook:event cost by using a boolean flag marked at registration 优化挂钩：使用在注册时标记的布尔标志的事件成本
      // instead of a hash lookup 而不是散列查找
      if (hookRE.test(event)) {
        vm._hasHookEvent = true
      }
    }
    return vm
  }

  Vue.prototype.$once = function (event: string, fn: Function): Component { //监听一个自定义事件，但是只触发一次。一旦触发之后，监听器就会被移除。
    const vm: Component = this
    function on () {
      vm.$off(event, on)
      fn.apply(vm, arguments)
    }
    on.fn = fn //为on绑定一个fn回调  在on方法执行时调用$off移除监听器  并执行fn回调
    vm.$on(event, on)
    return vm
  }

  Vue.prototype.$off = function (event?: string | Array<string>, fn?: Function): Component {
    // 移除自定义事件监听器。
    //   1.如果没有提供参数，则移除所有的事件监听器；
    //   2.如果只提供了事件，则移除该事件所有的监听器；
    //   3.如果同时提供了事件与回调，则只移除这个回调的监听器。
    const vm: Component = this
    // all
    if (!arguments.length) { //未提供参数
      vm._events = Object.create(null) //将vm._events定义一个空对象 => 移除里头保存的所有函数
      return vm
    }
    // array of events
    if (Array.isArray(event)) {//提供了事件 且是个数组
      for (let i = 0, l = event.length; i < l; i++) {
        vm.$off(event[i], fn)//递归  依次移除数组中的事件
      }
      return vm
    }
    // specific event event为特定事件  => 有具体名的事件
    const cbs = vm._events[event]  //在vm._events中查找该特定名的事件
    if (!cbs) { //事件不存在 则结束
      return vm
    }
    if (!fn) { //回调函数不存在  移除事件并返回
      vm._events[event] = null
      return vm
    }
    // specific handler  有特定处理程序
    let cb
    let i = cbs.length
    while (i--) {
      cb = cbs[i]
      if (cb === fn || cb.fn === fn) { //从vm._events[event]中查找所有函数  并找到对应的特定处理程序  最后移除
        cbs.splice(i, 1)
        break
      }
    }
    return vm
  }

  Vue.prototype.$emit = function (event: string): Component {//触发当前实例上的事件。附加参数都会传给监听器回调。
    const vm: Component = this
    if (process.env.NODE_ENV !== 'production') {//非生产模式  追踪
      const lowerCaseEvent = event.toLowerCase()
      if (lowerCaseEvent !== event && vm._events[lowerCaseEvent]) {
        tip(
          `Event "${lowerCaseEvent}" is emitted in component ` +
          `${formatComponentName(vm)} but the handler is registered for "${event}". ` +
          `Note that HTML attributes are case-insensitive and you cannot use ` +
          `v-on to listen to camelCase events when using in-DOM templates. ` +
          `You should probably use "${hyphenate(event)}" instead of "${event}".`
        )
      }
    }
    let cbs = vm._events[event]
    if (cbs) {
      cbs = cbs.length > 1 ? toArray(cbs) : cbs //长度大于1  伪数组转换成数组  ：  cbs   toArray接受两个参数cbs，i  生成数组  i到cbs.length的数组
      const args = toArray(arguments, 1) //args为$emit除了event之外的所有参数所组成的数组
      const info = `event handler for "${event}"`
      for (let i = 0, l = cbs.length; i < l; i++) {
        invokeWithErrorHandling(cbs[i], vm, args, vm, info) //调用vm._events[event]的函数  错误提醒 
      }
    }
    return vm
  }
}
