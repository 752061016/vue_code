/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true

export function toggleObserving (value: boolean) {
  shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */
export class Observer {
  value: any;
  dep: Dep;
  vmCount: number; // number of vms that have this object as root $data

  constructor (value: any) {
    this.value = value
    this.dep = new Dep()
    this.vmCount = 0
    // 为数据对象定义了一个 __ob__ 属性  这个属性的值就是当前 Observer 实例对象
    // 使用 def 函数定义 __ob__ 属性是因为这样可以定义不可枚举的属性，这样后面遍历数据对象的时候就能够防止遍历到 __ob__ 属性
    def(value, '__ob__', this)
    if (Array.isArray(value)) {//数组的处理方式
      if (hasProto) {// 当前环境支持 __proto__  将数组实例的原型指向代理原型(arrayMethods)
        protoAugment(value, arrayMethods)
      } else {// 当前环境不支持 __proto__
        copyAugment(value, arrayMethods, arrayKeys)
      }
      // 递归的观测那些类型为数组或对象的数组元素
      this.observeArray(value)
    } else {
      this.walk(value)
    }
  }

  /**
   * Walk through all properties and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  walk (obj: Object) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i])
    }
  }

  /**
   * Observe a list of Array items.
   */
  observeArray (items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment (target, src: Object) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
// asRootData:代表将要被观测的数据是否是根级数据
export function observe (value: any, asRootData: ?boolean): Observer | void {
  // 不是一个对象或者是 VNode 实例，则直接 return
  if (!isObject(value) || value instanceof VNode) {
    return
  }
  // 定义变量 ob，该变量用来保存 Observer 实例
  let ob: Observer | void
  // 检测数据对象 value 自身是否含有 __ob__ 属性，并且 __ob__ 属性应该是 Observer 的实例
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    // 当一个数据对象被观测之后将会在该对象上定义 __ob__ 属性，所以 if 分支的作用是用来避免重复观测一个数据对象
    ob = value.__ob__
  } else if (
    shouldObserve && // 初始值为 true  为 true 时说明打开了开关，此时可以对数据进行观测，为 false 时可以理解为关闭了开关，此时数据对象将不会被观测
    !isServerRendering() && // 判断是否是服务端渲染
    (Array.isArray(value) || isPlainObject(value)) && // 当数据对象是数组或纯对象
    Object.isExtensible(value) && // 被观测的数据对象必须是可扩展的  三个方法都可以使得一个对象变得不可扩展：Object.preventExtensions()、Object.freeze() 以及 Object.seal()
    !value._isVue // Vue 实例对象拥有 _isVue 属性，所以这个条件用来避免 Vue 实例对象被观测
  ) {
    // 创建一个 Observer 实例  真正将数据对象转换成响应式数据的是 Observer 函数
    ob = new Observer(value)
  }
  if (asRootData && ob) {
    ob.vmCount++
  }
  return ob
}

/**
 * Define a reactive property on an Object.
 * 核心就是 将数据对象的数据属性转换为访问器属性
 */
export function defineReactive (
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean
) {
  const dep = new Dep()

  // 获取该字段可能已有的属性描述对象，并将该对象保存在 property 常量中
  const property = Object.getOwnPropertyDescriptor(obj, key)
  // 判断该字段是否是可配置的，如果不可配置(property.configurable === false)，那么直接 return
  // 因为一个不可配置的属性是不能使用也没必要使用 Object.defineProperty 改变其属性定义的
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters
  // 分别保存了来自 property 对象的 get 和 set 函数
  // property 对象是属性的描述对象，一个对象的属性很可能已经是一个访问器属性了，所以该属性很可能已经存在 get 或 set 方法
  // 使用 Object.defineProperty 函数重新定义属性的 setter/getter，这会导致属性原有的 set 和 get 方法被覆盖，
  // 所以要将属性原有的 setter/getter 缓存，并在重新定义的 set 和 get 方法中调用缓存的函数
  const getter = property && property.get
  const setter = property && property.set
  // 在对象原本就是访问器属性并有getter时  不会对其本身进行深度观测 
  // 当属性拥有原本的 setter 时，即使拥有 getter 也要获取属性值并观测
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key]
  }

  // 定义了 childOb 变量，我们知道，在 if 语句块里面，获取到了对象属性的值 val，
  // 但是 val 本身有可能也是一个对象，那么此时应该继续调用 observe(val) 函数观测该对象从而深度观测数据对象。
  // 条件是函数的第五个参数须为false  因为第五个参数未传值  默认是undefined  默认就是深度观测
  // childOb === data.a.__ob__
  let childOb = !shallow && observe(val)
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter () {
      // 首先判断是否存在 getter，我们知道 getter 常量中保存的是属性原有的 get 函数，如果 getter 存在那么直接调用该函数，并以该函数的返回值作为属性的值，保证属性的原有读取操作正常运作
      const value = getter ? getter.call(obj) : val
      // Dep.target 中保存的值就是要被收集的依赖，如果 Dep.target 不存在就意味着没有需要被收集的依赖
      if (Dep.target) {
        // 这里闭包引用了上面的 dep 常量  收集依赖
        dep.depend()
        if (childOb) {
          // __ob__ 属性以及 __ob__.dep 的主要作用是为了添加、删除属性时有能力触发依赖，而这就是 Vue.set 或 Vue.delete 的原理
          childOb.dep.depend()
          // 如果读取的属性值是数组，那么需要调用 dependArray 函数逐个触发数组每个元素的依赖收集
          // 数组内部若是对象，在发生改变时相当于整个数组被改变  所以也需监听内部的数据变化
          if (Array.isArray(value)) {
            dependArray(value)
          }
        }
      }
      return value
    },
    set: function reactiveSetter (newVal) {
      // 取得属性原有的值
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      // 在原有值与新设置的值不相等的情况下才需要触发依赖和重新设置属性值  第二个条件表示两者都为NaN
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      // 如果 customSetter 函数存在，那么在非生产环境下修改这个值会执行 customSetter 函数    一般是错误报告
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      // #7981: for accessor properties without setter 不带setter的访问器属性
      if (getter && !setter) return
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      // 假如我们为属性设置的新值是一个数组或者纯对象，那么该数组或纯对象是未被观测的，所以需要对新值进行观测，同时使用新的观测对象重写 childOb 的值
      childOb = !shallow && observe(newVal)
      // dep 是属性用来收集依赖的”筐“，现在我们需要把”筐“里的依赖都执行一下，而这就是 dep.notify() 的作用
      dep.notify()
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
export function set (target: Array<any> | Object, key: any, val: any): any { //向响应式对象中添加一个属性，并确保这个新属性同样是响应式的，且触发视图更新
  if (process.env.NODE_ENV !== 'production' &&
    // isUndef 函数用来判断一个值是否是 undefined 或 null，如果是则返回 true，isPrimitive 函数用来判断一个值是否是原始类型值，如果是则返回 true
    // 理论上只能为对象(或数组)添加属性(或元素)
    (isUndef(target) || isPrimitive(target))
  ) { //非生产模式才触发
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {//target 是一个数组，并且 key 是一个有效的数组索引
    target.length = Math.max(target.length, key) //最大值
    // 将数组的长度修改为 target.length 和 key 中的较大者，否则如果当要设置的元素的索引大于数组长度时 splice 无效
    target.splice(key, 1, val) //为目标数组添加一个值  splice因为有拦截所以可以触发观测
    return val 
  }
  // 如果 target 不是一个数组，那么必然就是纯对象了，当给一个纯对象设置属性的时候，假设该属性已经在对象上有定义了
  // 那么只需要直接设置该属性的值即可，这将自动触发响应，因为已存在的属性是响应式的
  if (key in target && !(key in Object.prototype)) { //key 在 target 对象上，或在 target 的原型链上，同时必须不能在 Object.prototype 上
    target[key] = val //为target对象添加或覆盖一个值,自动触发响应
    return val
  }
  // 说明正在给对象添加一个全新的属性
  // 定义了 ob 常量，它是数据对象 __ob__ 属性的引用
  const ob = (target: any).__ob__
  // target._isVue  为 Vue 实例对象添加属性，为了避免属性覆盖的情况出现，Vue.set/$set 函数不允许这么做
  // 使用 Vue.set/$set 函数为根数据对象添加属性时，是不被允许的
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  // target 也许就是非响应的，这个时候 target.__ob__ 是不存在的，所以当发现 target.__ob__ 不存在时，就简单的赋值即可
  if (!ob) {
    target[key] = val
    return val
  }
  // 使用 defineReactive 函数设置属性值，这是为了保证新添加的属性是响应式的
  defineReactive(ob.value, key, val)
  // 调用了 __ob__.dep.notify() 从而触发响应
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del (target: Array<any> | Object, key: any) { //删除对象的属性。如果对象是响应式的，确保删除能触发更新视图。这个方法主要用于避开 Vue 不能检测到属性被删除的限制
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    // splice 方法是能够触发响应的
    target.splice(key, 1)
    return
  }
  const ob = (target: any).__ob__
  // 同样不能使用 Vue.delete/$delete 删除 Vue 实例对象或根数据的属性。
  // 不允许删除 Vue 实例对象的属性，是出于安全因素的考虑。而不允许删除根数据对象的属性，是因为这样做也是触发不了响应的
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  if (!hasOwn(target, key)) {
    return
  }
  // 如果 key 存在于 target 对象上，继续运行，使用 delete 语句从 target 上删除属性 key
  delete target[key]
  if (!ob) {
    return
  }
  // 如果 ob 对象存在，说明 target 对象是响应的，需要触发响应
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    // 如果该元素的值拥有 __ob__ 对象和 __ob__.dep 对象，那说明该元素也是一个对象或数组，此时只需要手动执行 __ob__.dep.depend() 即可达到收集依赖的目的
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      // 数组的元素仍然是一个数组，那么需要递归调用 dependArray 继续收集依赖
      dependArray(e)
    }
  }
}
