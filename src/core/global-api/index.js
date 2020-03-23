/* @flow */
// 在 Vue 构造函数上添加全局的API

import config from '../config'
import { initUse } from './use'
import { initMixin } from './mixin'
import { initExtend } from './extend'
import { initAssetRegisters } from './assets'
import { set, del } from '../observer/index'
import { ASSET_TYPES } from 'shared/constants'
import builtInComponents from '../components/index'
import { observe } from 'core/observer/index'

import {
  warn,
  extend,
  nextTick,
  mergeOptions,
  defineReactive
} from '../util/index'

export function initGlobalAPI (Vue: GlobalAPI) {
  // config
  const configDef = {}
  configDef.get = () => config
  if (process.env.NODE_ENV !== 'production') { //非生产模式
    configDef.set = () => {
      warn(
        'Do not replace the Vue.config object, set individual fields instead.'
      )
    }
  }
  Object.defineProperty(Vue, 'config', configDef)//Vue.config为只读属性

  // exposed util methods.
  // NOTE: these are not considered part of the public API - avoid relying on
  // them unless you are aware of the risk.
  //在 Vue 上添加了 util 属性，这是一个对象，这个对象拥有四个属性分别是：warn、extend、mergeOptions 以及 defineReactive。这四个属性来自于 core/util/index.js 文件。
  Vue.util = {
    warn,
    extend,
    mergeOptions,
    defineReactive
  }

  //在 Vue 上添加了四个属性分别是 set、delete、nextTick 以及 options
  Vue.set = set
  Vue.delete = del
  Vue.nextTick = nextTick

  // 2.6 explicit observable API
  Vue.observable = <T>(obj: T): T => {
    observe(obj)
    return obj
  }

  Vue.options = Object.create(null)
  ASSET_TYPES.forEach(type => {
    Vue.options[type + 's'] = Object.create(null)
  })

  // this is used to identify the "base" constructor to extend all plain-object
  // components with in Weex's multi-instance scenarios.
  Vue.options._base = Vue
  // Vue.options = {
  //   components: Object.create(null),
  //   directives: Object.create(null),
  //   filters: Object.create(null),
  //   _base: Vue
  // }

  extend(Vue.options.components, builtInComponents) //浅拷贝

  initUse(Vue)
  initMixin(Vue)
  initExtend(Vue)
  initAssetRegisters(Vue)
}
