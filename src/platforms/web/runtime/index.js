/* @flow */
// 设置平台化的 Vue.config。
// 在 Vue.options 上混合了两个指令(directives)，分别是 model 和 show。
// 在 Vue.options 上混合了两个组件(components)，分别是 Transition 和 TransitionGroup。
// 在 Vue.prototype 上添加了两个方法：__patch__ 和 $mount。
// Vue.options 以及 Vue.config 和 Vue.prototype 都有所变化  

import Vue from 'core/index' //vue构造函数 src/core/index.js
import config from 'core/config'
import { extend, noop } from 'shared/util'
import { mountComponent } from 'core/instance/lifecycle'
import { devtools, inBrowser } from 'core/util/index' //inBrowser为true  表示在浏览器中

import {
  query,
  mustUseProp,
  isReservedTag,
  isReservedAttr,
  getTagNamespace,
  isUnknownElement
} from 'web/util/index'

import { patch } from './patch'
import platformDirectives from './directives/index'
import platformComponents from './components/index'

// install platform specific utils 覆盖默认导出的Vue.config  与平台有关
Vue.config.mustUseProp = mustUseProp
Vue.config.isReservedTag = isReservedTag
Vue.config.isReservedAttr = isReservedAttr
Vue.config.getTagNamespace = getTagNamespace
Vue.config.isUnknownElement = isUnknownElement

// install platform runtime directives & components
// Vue.options.directives和Vue.options.components原本是空对象  现在要根据平台重新覆盖  
// 作用是在 Vue.options 上添加 web 平台运行时的特定组件和指令。
extend(Vue.options.directives, platformDirectives)
extend(Vue.options.components, platformComponents)

// install platform patch function 若在浏览器中， vue原型的__patch__则为函数  反之则是一个空函数
Vue.prototype.__patch__ = inBrowser ? patch : noop 

// public mount method 
// 如果 Vue 实例在实例化时没有收到 el 选项，则它处于“未挂载”状态，没有关联的 DOM 元素。可以使用 vm.$mount() 手动地挂载一个未挂载的实例
Vue.prototype.$mount = function (
  el?: string | Element,// 可以是一个字符串也可以是一个 DOM 元素
  hydrating?: boolean// 用于 Virtual DOM 的补丁算法
): Component {
  // 检测是否传递了 el 选项，如果传递了 el 选项则会接着判断 inBrowser 是否为真，即当前宿主环境是否是浏览器
  // 如果在浏览器中则将 el 透传给 query 函数并用返回值重写 el 变量，否则 el 将被重写为 undefined
  // 在浏览器环境下， el 变量将存储着 DOM 元素
  el = el && inBrowser ? query(el) : undefined
  // 调用了 mountComponent 函数完成真正的挂载工作，并返回(return)其运行结果
  return mountComponent(this, el, hydrating)
}

// devtools global hook
/* istanbul ignore next */ 
// vue-devtools 的全局钩子
if (inBrowser) {
  setTimeout(() => {
    if (config.devtools) {
      if (devtools) {
        devtools.emit('init', Vue)
      } else if (
        process.env.NODE_ENV !== 'production' &&
        process.env.NODE_ENV !== 'test'
      ) {
        console[console.info ? 'info' : 'log'](
          'Download the Vue Devtools extension for a better development experience:\n' +
          'https://github.com/vuejs/vue-devtools'
        )
      }
    }
    if (process.env.NODE_ENV !== 'production' &&
      process.env.NODE_ENV !== 'test' &&
      config.productionTip !== false &&
      typeof console !== 'undefined'
    ) {
      console[console.info ? 'info' : 'log'](
        `You are running Vue in development mode.\n` +
        `Make sure to turn on production mode when deploying for production.\n` +
        `See more tips at https://vuejs.org/guide/deployment.html`
      )
    }
  }, 0)
}

export default Vue
