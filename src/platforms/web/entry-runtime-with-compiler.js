/* @flow */
// vue 入口文件
import config from 'core/config'
import { warn, cached } from 'core/util/index'
import { mark, measure } from 'core/util/perf'

import Vue from './runtime/index' //vue的构造函数文件
import { query } from './util/index'
// 从 ./compiler/index.js 文件导入 compileToFunctions
import { compileToFunctions } from './compiler/index'
import { shouldDecodeNewlines, shouldDecodeNewlinesForHref } from './util/compat'

// 根据 id 获取元素的 innerHTML
const idToTemplate = cached(id => {
  const el = query(id)
  return el && el.innerHTML
})

// 缓存了运行时版 Vue 的 Vue.prototype.$mount 方法，并且进行了重写
// 使用 mount 变量缓存 Vue.prototype.$mount 方法 原先的mount方法是挂载dom元素用的
const mount = Vue.prototype.$mount

// 重写 Vue.prototype.$mount 方法 目的就是为了给运行时版的 $mount 函数增加编译模板的能力
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  el = el && query(el)

  /* istanbul ignore if */
  // 检测了挂载点是不是 <body> 元素或者 <html> 元素
  if (el === document.body || el === document.documentElement) {
    process.env.NODE_ENV !== 'production' && warn(
      `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
    )
    return this
  }

  const options = this.$options
  // resolve template/el and convert to render function
  // 检测是否包含 render 选项，即是否包含渲染函数
  // 如果渲染函数存在那么什么都不会做，直接调用运行时版 $mount 函数即可
  // 如果渲染函数不存在则会使用 template 或 el 选项构建渲染函数
  if (!options.render) {
    let template = options.template
    // 如果 template 选项存在
    if (template) {
      // template 的类型是字符串
      if (typeof template === 'string') {
        // 如果第一个字符是 #，那么会把该字符串作为 css 选择符去选中对应的元素，并把该元素的 innerHTML 作为模板
        // 如果第一个字符不是 #，那么什么都不做，就用 template 自身的字符串值作为模板
        if (template.charAt(0) === '#') {
          // 通过缓存来避免重复求值，提升性能，但函数并不改变原函数的行为，很显然原函数的功能是返回指定元素的 innerHTML 字符串
          template = idToTemplate(template)
          /* istanbul ignore if */
          if (process.env.NODE_ENV !== 'production' && !template) {
            warn(
              `Template element not found or is empty: ${options.template}`,
              this
            )
          }
        }
        // template 的类型是元素节点
      } else if (template.nodeType) {
        // 使用该元素的 innerHTML 作为模板
        template = template.innerHTML
        // 若 template 既不是字符串又不是元素节点，那么在非生产环境会提示开发者传递的 template 选项无效
      } else {
        if (process.env.NODE_ENV !== 'production') {
          warn('invalid template option:' + template, this)
        }
        return this
      }
      // 如果 template 选项不存在，那么使用 el 元素的 outerHTML 作为模板内容
    } else if (el) {
      // 接收一个 DOM 元素作为参数，并返回该元素的 outerHTML
      template = getOuterHTML(el)
    }

    // 理想状态下此时 template 变量应该是一个模板字符串，将来用于渲染函数的生成
    // template 变量中存储着最终用来生成渲染函数的字符串
    // 但这个 template 存在为空字符串的情况
    if (template) {
      // 作用：使用 compileToFunctions 函数将模板(template)字符串编译为渲染函数(render)，并将渲染函数添加到 vm.$options 选项中
      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile')
      }

      const { render, staticRenderFns } = compileToFunctions(template, {
        outputSourceRange: process.env.NODE_ENV !== 'production',
        shouldDecodeNewlines,
        shouldDecodeNewlinesForHref,
        delimiters: options.delimiters,
        comments: options.comments
      }, this)
      options.render = render
      options.staticRenderFns = staticRenderFns

      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile end')
        measure(`vue ${this._name} compile`, 'compile', 'compile end')
      }
    }
  }
  return mount.call(this, el, hydrating)
}

/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 * 获取元素的 outerHTML
 */
function getOuterHTML (el: Element): string {
  // 首先判断了 el.outerHTML 是否存在，也就是说一个元素的 outerHTML 属性未必存在
  if (el.outerHTML) {
    return el.outerHTML
    // 在 IE9-11 中 SVG 标签元素是没有 innerHTML 和 outerHTML 这两个属性的
  } else {
    // 把 SVG 元素放到一个新创建的 div 元素中，这样新 div 元素的 innerHTML 属性的值就等价于 SVG 标签 outerHTML 的值
    const container = document.createElement('div')
    container.appendChild(el.cloneNode(true))
    return container.innerHTML
  }
}
// 在 Vue 上添加一个全局API `Vue.compile` 其值为上面导入进来的 compileToFunctions
// Vue.compile() 将一个模板字符串编译成 render 函数。只在完整版时可用。
Vue.compile = compileToFunctions

export default Vue
