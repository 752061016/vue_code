/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import Dep, { pushTarget, popTarget } from '../observer/dep'
import { isUpdatingChildComponent } from './lifecycle'

import {
  set,
  del,
  observe,
  defineReactive,
  toggleObserving
} from '../observer/index'

import {
  warn,
  bind,
  noop,
  hasOwn,
  hyphenate,
  isReserved,
  handleError,
  nativeWatch,
  validateProp,
  isPlainObject,
  isServerRendering,
  isReservedAttribute
} from '../util/index'

const sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
}

export function proxy (target: Object, sourceKey: string, key: string) {
  sharedPropertyDefinition.get = function proxyGetter () {
    return this[sourceKey][key]
  }
  sharedPropertyDefinition.set = function proxySetter (val) {
    this[sourceKey][key] = val
  }
  // 通过 Object.defineProperty 函数在实例对象 vm 上定义与 data 数据字段同名的访问器属性  访问vm.num ==> vm._data.num
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

export function initState (vm: Component) {
  // 首先在 Vue 实例对象添加一个属性 vm._watchers = []，其初始值是一个数组，这个数组将用来存储所有该组件实例的 watcher 对象
  vm._watchers = []
  // opts是实例上的参数的引用
  const opts = vm.$options
  if (opts.props) initProps(vm, opts.props)
  if (opts.methods) initMethods(vm, opts.methods)
  if (opts.data) {
    initData(vm)
  } else {
    // observe 函数是将 data 转换成响应式数据的核心入口
    // $data 属性是一个访问器属性，其代理的值就是 _data
    observe(vm._data = {}, true /* asRootData */)
  }
  // 初始化computed
  if (opts.computed) initComputed(vm, opts.computed)
  // 对于 watch 选项仅仅判断 opts.watch 是否存在是不够的，还要判断 opts.watch 是不是原生的 watch 对象
  if (opts.watch && opts.watch !== nativeWatch) {
    // 初始化 watch 选项
    initWatch(vm, opts.watch)
  }
}

function initProps (vm: Component, propsOptions: Object) {
  // 组件上的数据 存储着外界传递进来的 props 的值
  const propsData = vm.$options.propsData || {}
  const props = vm._props = {}
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.
  const keys = vm.$options._propKeys = []
  // isRoot 常量用来标识是否是根组件 根组件实例的 $parent 属性的值是不存在的
  const isRoot = !vm.$parent
  // root instance props should be converted
  if (!isRoot) {
    // 类似开关  关闭深度监测功能  props的值本身是响应式的  但不会深度响应
    // 只有当不是根组件的时候才会关闭开关，这说明如果当前组件实例是根组件的话，那么定义的 props 的值也会被定义为响应式数据
    toggleObserving(false)
  }
  for (const key in propsOptions) {
    // 遍历props对象
    keys.push(key)
    // 用来校验名字(key)给定的 prop 数据是否符合预期的类型  常量 value 中保存着 prop 的值
    const value = validateProp(key, propsOptions, propsData, vm)
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      // 使用 hyphenate 将 prop 的名字转为连字符加小写的形式
      const hyphenatedKey = hyphenate(key)
      // 判断 prop 的名字是否是保留的属性attribute
      if (isReservedAttribute(hyphenatedKey) ||
          // 打印警告
          config.isReservedAttr(hyphenatedKey)) {
        warn(
          `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
          vm
        )
      }
      defineReactive(props, key, value, () => {
        if (!isRoot && !isUpdatingChildComponent) {
          warn(
            `Avoid mutating a prop directly since the value will be ` +
            `overwritten whenever the parent component re-renders. ` +
            `Instead, use a data or computed property based on the prop's ` +
            `value. Prop being mutated: "${key}"`,
            vm
          )
        }
      })
    } else {
      // 在 vm._props 上定义了 prop 数据
      defineReactive(props, key, value)
    }
    // static props are already proxied on the component's prototype
    // during Vue.extend(). We only need to proxy props defined at
    // instantiation here.
    // 只有当 key 不在组件实例对象上以及其原型链上没有定义时才会进行代理
    // 目的是避免每次创建子组件实例时都会调用 proxy 函数去做代理
    if (!(key in vm)) {
      // 在组件实例对象上定义与 props 同名的属性，使得我们能够通过组件实例对象直接访问 props 数据
      proxy(vm, `_props`, key)
    }
  }
  toggleObserving(true)
}

// 根据 vm.$options.data 选项获取真正想要的数据（注意：此时 vm.$options.data 是函数）
// 校验得到的数据是否是一个纯对象
// 检查数据对象 data 上的键是否与 props 对象上的键冲突
// 检查 methods 对象上的键是否与 data 对象上的键冲突
// 在 Vue 实例对象上添加代理访问数据对象的同名属性
// 最后调用 observe 函数开启响应式之路
function initData (vm: Component) {
  let data = vm.$options.data
  // 经过 mergeOptions 函数处理后 data 选项必然是一个函数
  // 因为 beforeCreate 生命周期钩子函数是在 mergeOptions 函数之后 initData 之前被调用的，
  // 如果在 beforeCreate 生命周期钩子函数中修改了 vm.$options.data 的值，那么在 initData 函数中对于 vm.$options.data 类型的判断就是必要的了
  data = vm._data = typeof data === 'function'
    ? getData(data, vm)
    : data || {}
  // 此时 data 变量已经不是函数了，而是最终的数据对象
  // 判断变量 data 是不是一个纯对象  若不是纯对象则打印错误信息
  if (!isPlainObject(data)) {
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }
  // proxy data on instance  代理
  // 首先使用 Object.keys 函数获取 data 对象的所有键
  const keys = Object.keys(data)
  const props = vm.$options.props
  const methods = vm.$options.methods
  let i = keys.length
  while (i--) {
    const key = keys[i]
    if (process.env.NODE_ENV !== 'production') {
      // 在非生产环境下如果发现在 methods 对象上定义了同样的 key，也就是说 data 数据的 key 与 methods 对象中定义的函数名称相同，那么会打印一个警告，提示开发者
      // Vue 是不允许在 methods 中定义与 data 字段的 key 重名的函数的
      if (methods && hasOwn(methods, key)) {
        warn(
          `Method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }
    // 如果发现 data 数据字段的 key 已经在 props 中有定义了，那么就会打印警告
    // 优先级的关系：props优先级 > methods优先级 > data优先级
    if (props && hasOwn(props, key)) {
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
    // 判断定义在 data 中的 key 是否是保留键  首字符不是$或_
    // isReserved 函数通过判断一个字符串的第一个字符是不是 $ 或 _ 来决定其是否是保留的，Vue 是不会代理那些键名以 $ 或 _ 开头的字段的，
    // 因为 Vue 自身的属性和方法都是以 $ 或 _ 开头的，所以这么做是为了避免与 Vue 自身的属性和方法相冲突
    } else if (!isReserved(key)) {
      // 如果 key 既不是以 $ 开头，又不是以 _ 开头，那么将执行 proxy 函数，实现实例对象的代理访问
      proxy(vm, `_data`, key)
    }
  }
  // observe data
  // 调用 observe 函数将 data 数据对象转换成响应式的
  observe(data, true /* asRootData */)
}

export function getData (data: Function, vm: Component): any {
  // #7573 disable dep collection when invoking data getters
  // pushTarget  和  popTarget防止使用 props 数据初始化 data 数据时收集冗余的依赖
  pushTarget()
  try {
    return data.call(vm, vm)
  } catch (e) {
    handleError(e, vm, `data()`)
    return {}
  } finally {
    popTarget()
  }
}

const computedWatcherOptions = { lazy: true }
// 初始化Computed
function initComputed (vm: Component, computed: Object) {
  // $flow-disable-line
  const watchers = vm._computedWatchers = Object.create(null)
  // computed properties are just getters during SSR
  // 判断是否是服务端渲染的布尔值
  const isSSR = isServerRendering()

  for (const key in computed) {
    const userDef = computed[key]
    const getter = typeof userDef === 'function' ? userDef : userDef.get
    if (process.env.NODE_ENV !== 'production' && getter == null) {
      warn(
        `Getter is missing for computed property "${key}".`,
        vm
      )
    }

    // 非服务端渲染时才会执行
    if (!isSSR) {
      // create internal watcher for the computed property.
      // 计算属性的实现本质上和使用 methods 选项差不多
      // watchers的引用于vm._computedWatchers相同  所以当watchers发生改变时vm._computedWatchers也会改变  实际上是由vm._computedWatchers存储计算属性观察者
      watchers[key] = new Watcher(
        vm,
        getter || noop,
        noop,
        computedWatcherOptions //{ lazy: true }用来标识一个观察者对象是计算属性的观察者
      )
    }

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    // 初始化计算属性之前已经初始化了 props、methods 和 data 选项,并且这些选项数据都会定义在组件实例对象上
    // 由于计算属性也需要定义在组件实例对象上，所以需要使用计算属性的名字检查组件实例对象上是否已经有了同名的定义
    // 对于 data 和 props 来讲他们是不允许被 computed 选项中的同名属性覆盖的
    // 检查计算属性的名字是否已经存在于组件实例对象中
    // 触发更新时只是更新dep中的update，在初始化时，计算属性的依赖就收到了计算属性的dep并保存，在依赖发生改变时同样也会触发计算属性上watcher的update
    if (!(key in vm)) {
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      if (key in vm.$data) {
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) {
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      }
    }
  }
}

export function defineComputed (
  target: any,
  key: string,
  userDef: Object | Function
) {
  // 以下代码都是完善sharedPropertyDefinition对象的  访问器属性
  // sharedPropertyDefinition = {
  //   enumerable: true,
  //   configurable: true,
  //   get: noop,
  //   set: noop
  // }
  const shouldCache = !isServerRendering()
  if (typeof userDef === 'function') {
    // 使用三元运算符检查 shouldCache 是否为真
    sharedPropertyDefinition.get = shouldCache
      // 如果为真说明不是服务端渲染，此时会调用 createComputedGetter 函数并将其返回值作为 sharedPropertyDefinition.get 的值
      ? createComputedGetter(key)
      // 如果 shouldCache 为假说明是服务端渲染，由于服务端渲染不需要缓存值，使用 createGetterInvoker 函数作为 sharedPropertyDefinition.get 的值
      : createGetterInvoker(userDef)
      // 由于 userDef 是函数，这说明该计算属性并没有指定 set 拦截器函数，所以直接将其设置为空函数 noop
    sharedPropertyDefinition.set = noop
  } else {//object
    sharedPropertyDefinition.get = userDef.get
      // Object.get() 存在
      ? shouldCache && userDef.cache !== false
        // 不是服务端渲染且userDef.cache !== false
        ? createComputedGetter(key)
        : createGetterInvoker(userDef.get)
      // Object.get() 不存在
      : noop
    sharedPropertyDefinition.set = userDef.set || noop
  }
  // 在非生产环境下如果发现 sharedPropertyDefinition.set 的值是一个空函数，那么说明开发者并没有为计算属性定义相应的 set 拦截器函数，这时会重写 sharedPropertyDefinition.set 函数
  // 这样当你在代码中尝试修改一个没有指定 set 拦截器函数的计算属性的值时，就会得到一个警告信息
  if (process.env.NODE_ENV !== 'production' &&
      sharedPropertyDefinition.set === noop) {
    sharedPropertyDefinition.set = function () {
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }

  // computed: {
  //   someComputedProp () {
  //     return this.a + this.b
  //   }
  // }
  // 在非服务端渲染的情况下会转换成：
  // sharedPropertyDefinition = {
  //   enumerable: true,
  //   configurable: true,
  //   get: createComputedGetter(key),
  //   set: noop // 没有指定 userDef.set 所以是空函数
  // }
  
  Object.defineProperty(target, key, sharedPropertyDefinition)
  // 在触发计算属性更新时 get只是返回了一个函数但并未执行 并把返回的函数保存在 this.value中  在createComputedGetter最后返回
}

function createComputedGetter (key) { // key为函数名
  // 当计算属性被读取时，computedGetter 函数将会执行
  return function computedGetter () {
    // 定义了 watcher 常量，它的值为计算属性的观察者对象
    const watcher = this._computedWatchers && this._computedWatchers[key] 
    if (watcher) {
      // 该观察者对象存在，则会分别执行观察者对象的 depend 方法和 evaluate 方法
      if (watcher.dirty) { // 判断是否为计算属性
        watcher.evaluate()
      }
      if (Dep.target) {
        watcher.depend()
      }
      return watcher.value
    }
  }
}

function createGetterInvoker(fn) {
  return function computedGetter () {
    return fn.call(this, this)
  }
}

function initMethods (vm: Component, methods: Object) {
  const props = vm.$options.props
  for (const key in methods) {
    if (process.env.NODE_ENV !== 'production') {
      // 检测该值是否为函数
      if (typeof methods[key] !== 'function') {
        warn(
          `Method "${key}" has type "${typeof methods[key]}" in the component definition. ` +
          `Did you reference the function correctly?`,
          vm
        )
      }
      // 存在props且函数名与props重名
      if (props && hasOwn(props, key)) {
        warn(
          `Method "${key}" has already been defined as a prop.`,
          vm
        )
      }
      // 该键已在实例上定义且 key 为保留的属性名（以字符 $ 或 _ 开头的名字为保留名，可能与$data这些原生内置属性重名）
      if ((key in vm) && isReserved(key)) {
        warn(
          `Method "${key}" conflicts with an existing Vue instance method. ` +
          `Avoid defining component methods that start with _ or $.`
        )
      }
    }
    // 在组件实例对象上定义了与 methods 选项中所定义的同名方法，当然了在定义到组件实例对象之前要检测该方法是否真正的有定义：methods[key] == null，如果没有则添加一个空函数到组件实例对象上
    vm[key] = typeof methods[key] !== 'function' ? noop : bind(methods[key], vm)
  }
}

function initWatch (vm: Component, watch: Object) {
  // 通过对 watch 选项遍历，然后通过 createWatcher 函数创建观察者对象的
  for (const key in watch) {
    const handler = watch[key]
    // handler 常量可以是一个数组 数组中包括多个函数 在观测发生改变时会依次执行
    if (Array.isArray(handler)) {
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    } else {
      createWatcher(vm, key, handler)
    }
  }
}

function createWatcher ( //创建监听者 vm实例
  vm: Component,
  expOrFn: string | Function,
  handler: any,
  options?: Object
) {
  // vm.$watch('name', {
  //   handler () {
  //     console.log('change')
  //   },
  //   immediate: true
  // })
  // 将纯对象形式的参数规范化一下，然后再通过 $watch 方法创建观察者
  if (isPlainObject(handler)) { //为对象
    options = handler
    handler = handler.handler
  }
  // handler为字符串  则在vue实例上查找该方法
  if (typeof handler === 'string') {
    handler = vm[handler]
  }
  return vm.$watch(expOrFn, handler, options)
}

export function stateMixin (Vue: Class<Component>) {
  // flow somehow has problems with directly declared definition object
  // when using Object.defineProperty, so we have to procedurally build up
  // the object here.
  const dataDef = {}
  dataDef.get = function () { return this._data }
  const propsDef = {}
  propsDef.get = function () { return this._props }
  if (process.env.NODE_ENV !== 'production') {//非生产模式  在生产模式下 $data和$props两个属性是只读的  无法修改
    dataDef.set = function () {//响应追踪
      warn(
        'Avoid replacing instance root $data. ' +
        'Use nested data properties instead.',
        this
      )
    }
    propsDef.set = function () {
      warn(`$props is readonly.`, this)
    }
  }
  Object.defineProperty(Vue.prototype, '$data', dataDef) //拦截器
  Object.defineProperty(Vue.prototype, '$props', propsDef)

  Vue.prototype.$set = set  //../observer/index
  Vue.prototype.$delete = del //../observer/index

  //观察 Vue 实例上的一个表达式或者一个函数计算结果的变化。回调函数得到的参数为新值和旧值。表达式只接受监督的键路径。
  // 允许我们观察数据对象的某个属性，当属性变化时执行回调
  Vue.prototype.$watch = function ( 
    expOrFn: string | Function,
    cb: any,
    options?: Object
  ): Function {
    // 当前组件实例对象
    const vm: Component = this
    if (isPlainObject(cb)) {//简单对象  参数为对象
      return createWatcher(vm, expOrFn, cb, options)
    }
    // cb为函数
    options = options || {}
    options.user = true
    // options = {
    //   ...
    //   user: true
    // }
    const watcher = new Watcher(vm, expOrFn, cb, options) // 创建监听器
    if (options.immediate) { //immediate为true  该回调将会在侦听开始之后被立即调用
      try {
        // 此时回调函数的参数只有新值没有旧值。同时取值的方式是通过前面创建的观察者实例对象的 watcher.value 属性
        // 观察者实例对象的 value 属性，保存着被观察属性的值
        cb.call(vm, watcher.value)
      } catch (error) {
        handleError(error, vm, `callback for immediate watcher "${watcher.expression}"`)
      }
    }
    return function unwatchFn () {
      // $watch 函数返回一个函数，这个函数的执行会解除当前观察者对属性的观察
      watcher.teardown()
    }
  }
}
