/* @flow */

import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0 //实例标识

export function initMixin (Vue: Class<Component>) { //参数为vue 实例 接口类型  传入的是什么类型  component就为什么类型
  Vue.prototype._init = function (options?: Object) { //为vue原型添加_init方法 在new vue创建时会执行 options为new vue时传入的对象参数
    const vm: Component = this  // vm指向当前的vue实例
    // a uid
    vm._uid = uid++ //每个实例会有个标识  每次实例化后都会++ 初始化为0

    let startTag, endTag
    /* istanbul ignore if */
    // 在非生产环境下，并且 config.performance 和 mark 都为真

    // Vue 提供了全局配置 Vue.config.performance，我们通过将其设置为 true，即可开启性能追踪，你可以追踪四个场景的性能：
    //     1、组件初始化(component init)
    //     2、编译(compile)，将模板(template)编译成渲染函数
    //     3、渲染(render)，其实就是渲染函数的性能，或者说渲染函数执行且生成虚拟DOM(vnode)的性能
    //     4、打补丁(patch)，将虚拟DOM渲染为真实DOM的性能  
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }



    // a flag to avoid this being observed 避免这种情况被注意到的标志
    // 目的是用来标识一个对象是 Vue 实例
    vm._isVue = true
    // merge options  options._isComponent只有在创建组件时才会存在
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      initInternalComponent(vm, options)
    } else {
      // 在 Vue 实例上添加了 $options 属性  在下方一系列的init*的方法中会被用到
      // 用于当前 Vue 实例的初始化选项。需要在选项中包含自定义属性时会有用处
      // new Vue({
      //   customOption: 'foo',
      //   created: function () {
      //     console.log(this.$options.customOption) // => 'foo'
      //   }
      // })
      // $options 用于当前 Vue 实例的初始化选项。需要在选项中包含自定义属性时会有用处
      vm.$options = mergeOptions(
        // 返回vm.constructor.options
        // 若是Vue的实例则返回Vue.options
        // Vue.options = {
        //   components: {
        //     KeepAlive
        //     Transition,
        //       TransitionGroup
        //   },
        //   directives:{
        //       model,
        //         show
        //   },
        //   filters: Object.create(null),
        //   _base: Vue
        // }
        resolveConstructorOptions(vm.constructor),
        // new Vue()时传入的参数对象  若无则为空对象
        options || {},
        // 当前的vue实例
        vm
      )
    }
    /* istanbul ignore else */
    // 如果是非生产环境的话则执行 initProxy(vm) 函数，如果在生产环境则直接在实例上添加 _renderProxy 实例属性，该属性的值就是当前实例
    // vm._renderProxy 有可能是一个代理对象，即 Proxy 实例
    if (process.env.NODE_ENV !== 'production') {
      // 作用其实就是在实例对象 vm 上添加 _renderProxy 属性
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // expose real self
    // 在 Vue 实例对象 vm 上添加了 _self 属性，指向真实的实例本身
    vm._self = vm
    initLifecycle(vm)
    initEvents(vm)
    initRender(vm)
    callHook(vm, 'beforeCreate')
    initInjections(vm) // resolve injections before data/props
    initState(vm)
    initProvide(vm) // resolve provide after data/props
    callHook(vm, 'created')



    /* istanbul ignore if 同上  性能追踪*/
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`vue ${vm._name} init`, startTag, endTag)
    }

    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}

export function initInternalComponent (vm: Component, options: InternalComponentOptions) {
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration.
  const parentVnode = options._parentVnode
  opts.parent = options.parent
  opts._parentVnode = parentVnode

  const vnodeComponentOptions = parentVnode.componentOptions
  opts.propsData = vnodeComponentOptions.propsData
  opts._parentListeners = vnodeComponentOptions.listeners
  opts._renderChildren = vnodeComponentOptions.children
  opts._componentTag = vnodeComponentOptions.tag

  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}
//解析构造者的 options  
// const Sub = Vue.extend()  会给Sub附加一个super属性并指向Vue
export function resolveConstructorOptions (Ctor: Class<Component>) {//vm.constructor
  
  let options = Ctor.options
  // 函数的作用是将options返回  
  // 但传入的实例的构造函数并不是vue 则会存在Ctor.super=vue这个属性  若是直接使用vue构造的则会直接返回vm.constructor.options
  if (Ctor.super) {
    //递归的调用该函数  直到找到Vue的options
    const superOptions = resolveConstructorOptions(Ctor.super)
    const cachedSuperOptions = Ctor.superOptions //Vue.options  在Vue.extend()操作时被添加的属性  指向Vue的options
    if (superOptions !== cachedSuperOptions) {
      // super option changed, superOptions被修改
      // need to resolve new options. 新属性等会被解决掉  给Ctor.superOptions重新赋值Vue.options
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976) 
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  return options
}
// 检查是否有任何后期修改/附加的选项
function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
  let modified
  const latest = Ctor.options
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = latest[key]
    }
  }
  return modified
}
