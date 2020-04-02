/* @flow */

import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError,
  noop
} from '../util/index'

import { traverse } from './traverse'
import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'

import type { SimpleSet } from '../util/index'

let uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 */
export default class Watcher {
  vm: Component;
  expression: string;
  cb: Function;
  id: number;
  deep: boolean;
  user: boolean;
  lazy: boolean;
  sync: boolean;
  dirty: boolean;
  active: boolean;
  deps: Array<Dep>;
  newDeps: Array<Dep>;
  depIds: SimpleSet;
  newDepIds: SimpleSet;
  before: ?Function;
  getter: Function;
  value: any;

  constructor (
    vm: Component,             // 当前vue实例
    expOrFn: string | Function,// 监听的值
    cb: Function,              // 回调函数
    options?: ?Object,         // 配置参数
    isRenderWatcher?: boolean  // 用来标识该观察者实例是否是渲染函数
  ) {
    this.vm = vm
    // 只有在 mountComponent 函数中创建渲染函数观察者时这个参数为真
    if (isRenderWatcher) { //第一次渲染监听器
      vm._watcher = this
    }
    vm._watchers.push(this) //添加一个新的监听器
    // options
    if (options) { //实例对象  无配置则默认全为false
      this.deep = !!options.deep  //用来告诉当前观察者实例对象是否是深度观测
      this.user = !!options.user  //用来标识当前观察者实例对象是 开发者定义的 还是 内部定义的
      this.lazy = !!options.lazy  //用来标识当前观察者实例对象是否是计算属性的观察者
      this.sync = !!options.sync  //用来告诉观察者当数据变化时是否同步求值并执行回调
      this.before = options.before//可以理解为 Watcher 实例的钩子，当数据变化之后，触发更新之前，调用在创建渲染函数的观察者实例对象时传递的 before 选项
    } else {
      this.deep = this.user = this.lazy = this.sync = false 
    }
    // 定义了 this.cb 属性，它的值为 cb 回调函数
    this.cb = cb
    // 定义了 this.id 属性，它是观察者实例对象的唯一标识
    this.id = ++uid // uid for batching
    // 定义了 this.active 属性，它标识着该观察者实例对象是否是激活状态，默认值为 true 代表激活
    this.active = true
    // 定义了 this.dirty 属性，该属性的值与 this.lazy 属性的值相同
    // 也就是说只有计算属性的观察者实例对象的 this.dirty 属性的值才会为真，因为计算属性是惰性求值
    this.dirty = this.lazy // for lazy watchers

    // this.deps 与 this.depIds 为一组，this.newDeps 与 this.newDepIds 为一组
    // 用来实现避免收集重复依赖，且移除无用依赖的功能也依赖于它们
    this.deps = []
    this.newDeps = []
    this.depIds = new Set()
    this.newDepIds = new Set()

    // 在非生产环境下该属性的值为表达式(expOrFn)的字符串表示，在生产环境下其值为空字符串。
    // 所以可想而知 this.expression 属性肯定是在非生产环境下使用的
    this.expression = process.env.NODE_ENV !== 'production' //生产
      ? expOrFn.toString()
      : ''


    // parse expression for getter
    if (typeof expOrFn === 'function') {
      // 如果 expOrFn 是函数，那么直接使用 expOrFn 作为 this.getter 属性的值
      this.getter = expOrFn
    } else {
      // 如果 expOrFn 不是函数，那么将 expOrFn 透传给 parsePath 函数，并以 parsePath 函数的返回值作为 this.getter 属性的值
      // this.getter 函数终将会是一个函数
      this.getter = parsePath(expOrFn)
      if (!this.getter) { //expOrFn为空或不存在  解析表达式的时候失败了
        this.getter = noop
        process.env.NODE_ENV !== 'production' && warn(
          // 只接受简单的点(.)分隔路径，如果你要用全部的 js 语法特性直接观察一个函数即可
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }
    // 计算属性的观察者和其他观察者实例对象的处理方式是不同的
    this.value = this.lazy
      ? undefined // 若是计算属性观察者  则默认为undefined
      : this.get()
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   */
  // 依赖收集
  get () {
    // pushTarget 函数的作用就是用来为 Dep.target 属性赋值的
    // pushTarget 函数会将接收到的参数赋值给 Dep.target 属性
    pushTarget(this)
    // this.value 属性保存着被观察目标的值
    let value
    const vm = this.vm
    try {
      value = this.getter.call(vm, vm)
    } catch (e) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      // 深度观测
      if (this.deep) {
        traverse(value)
      }
      popTarget()
      this.cleanupDeps()
    }
    return value
  }

  /**
   * Add a dependency to this directive.
   */
  addDep (dep: Dep) {
    const id = dep.id
    if (!this.newDepIds.has(id)) {
      this.newDepIds.add(id)
      this.newDeps.push(dep)
      if (!this.depIds.has(id)) {
        dep.addSub(this)
      }
    }
  }

  /**
   * Clean up for dependency collection.
   */
  cleanupDeps () {
    let i = this.deps.length
    while (i--) {
      // 移除废弃的观察者
      const dep = this.deps[i]
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this)
      }
    }
    // newDepIds 属性和 newDeps 属性被清空，并且在被清空之前把值分别赋给了 depIds 属性和 deps 属性，
    // 这两个属性将会用在下一次求值时避免依赖的重复收集
    // 1、newDepIds 属性用来在一次求值中避免收集重复的观察者
    // 2、每次求值并收集观察者完成之后会清空 newDepIds 和 newDeps 这两个属性的值，并且在被清空之前把值分别赋给了 depIds 属性和 deps 属性
    // 3、depIds 属性用来避免重复求值时收集重复的观察者
    // newDepIds 和 newDeps 这两个属性的值所存储的总是当次求值所收集到的 Dep 实例对象，
    // 而 depIds 和 deps 这两个属性的值所存储的总是上一次求值过程中所收集到的 Dep 实例对象
    let tmp = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   */
  update () {
    /* istanbul ignore else */
    if (this.lazy) {// 计算属性的观察者
      this.dirty = true
    } else if (this.sync) {//创建观察者实例对象时传递的第三个选项参数中的 sync 属性的值
      // 同步更新变化
      this.run()
    } else {
      // 将当前观察者对象放到一个异步更新队列
      queueWatcher(this)
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   */
  run () {
    if (this.active) {
      // 重新求值
      // 重新求值其实等价于重新执行渲染函数，最终结果就是重新生成了虚拟DOM并更新真实DOM，这样就完成了重新渲染的过程
      const value = this.get()
      // if 语句块内的代码是为非渲染函数类型的观察者准备的，它用来对比新旧两次求值的结果，当值不相等的时候会调用通过参数传递进来的回调
      if (
        // 对比新值 value 和旧值 this.value 是否相等
        value !== this.value ||
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated.
        // 判断新值的类型是否是对象,如果是对象的话即使值不变也需要执行回调
        isObject(value) ||
        this.deep
      ) {
        // set new value
        // 设置旧值
        const oldValue = this.value
        // 设置新值
        this.value = value
        if (this.user) {
          try {
            // 触发回调
            this.cb.call(this.vm, value, oldValue)
          } catch (e) {
            // 错误提醒
            handleError(e, this.vm, `callback for watcher "${this.expression}"`)
          }
        } else {
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   */
  evaluate () {
    // evaluate 方法中求值的那句代码最终所执行的求值函数就是用户定义的计算属性的 get 函数
    // 执行时会触发函数中的dep属性中的get拦截器，并使dep收到一个依赖，这个依赖实际上就是计算属性的观察者对象
    this.value = this.get()
    this.dirty = false
  }

  /**
   * Depend on all deps collected by this watcher.
   */
  depend () {
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   */
  teardown () {
    // 如果为假则说明该观察者已经不处于激活状态
    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      // 每个组件实例都有一个 vm._isBeingDestroyed 属性，它是一个标识，为真说明该组件实例已经被销毁了，为假说明该组件还没有被销毁
      if (!this.vm._isBeingDestroyed) {
        // 观察者实例从组件实例对象的 vm._watchers 数组中移除
        remove(this.vm._watchers, this)
      }
      // 将当前观察者实例对象从所有的 Dep 实例对象中移除
      let i = this.deps.length
      while (i--) {
        this.deps[i].removeSub(this)
      }
      // 将观察者设置为非激活状态
      this.active = false
    }
  }
}
