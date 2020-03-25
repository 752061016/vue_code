/* @flow */

import config from '../config'
import { warn } from './debug'
import { set } from '../observer/index'
import { unicodeRegExp } from './lang'
import { nativeWatch, hasSymbol } from './env'

import {
  ASSET_TYPES,
  LIFECYCLE_HOOKS
} from 'shared/constants'

import {
  extend,
  hasOwn,
  camelize,
  toRawType,
  capitalize,
  isBuiltInTag,
  isPlainObject
} from 'shared/util'

/**
 * Option overwriting strategies are functions that handle
 * how to merge a parent option value and a child option
 * value into the final value.
 */
const strats = config.optionMergeStrategies

/**
 * Options with restrictions 
 * 默认的合并策略
 */
if (process.env.NODE_ENV !== 'production') { //非生产模式
  strats.el = strats.propsData = function (parent, child, vm, key) {
    if (!vm) {
      warn(
        `option "${key}" can only be used during instance ` +
        'creation with the `new` keyword.'
      )
    }
    return defaultStrat(parent, child)
  }
}

/**
 * Helper that recursively merges two data objects together.深拷贝
 */
function mergeData (to: Object, from: ?Object): Object {
  if (!from) return to
  let key, toVal, fromVal

  const keys = hasSymbol
    ? Reflect.ownKeys(from)
    : Object.keys(from)

  for (let i = 0; i < keys.length; i++) {
    key = keys[i]
    // in case the object is already observed...
    if (key === '__ob__') continue
    toVal = to[key]
    fromVal = from[key]
    if (!hasOwn(to, key)) {
      // 如果 from 对象中的 key 不在 to 对象中，则使用 set 函数为 to 对象设置 key 及相应的值。
      set(to, key, fromVal)
    } else if (
      toVal !== fromVal &&
      isPlainObject(toVal) &&
      isPlainObject(fromVal)
    ) {
      // 如果 from 对象中的 key 在 to 对象中，且这两个属性的值都是纯对象则递归地调用 mergeData 函数进行深度合并。
      mergeData(toVal, fromVal)
    }
  }
  // 将 from 对象的属性混合到 to 对象中，也可以说是将 parentVal 对象的属性混合到 childVal 中，最后返回的是处理后的 childVal 对象。
  return to
}

/**
 * Data
 */
export function mergeDataOrFn (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  if (!vm) {//子组件
    // in a Vue.extend merge, both should be functions 选项是在调用 Vue.extend 函数时进行合并处理的，此时父子 data 选项都应该是函数
    // 当拿不到 vm 这个参数的时候，合并操作是在 Vue.extend 中进行的，也就是在处理子组件的选项。而且此时 childVal 和 parentVal 都应该是函数
    if (!childVal) {
      return parentVal
    }
    if (!parentVal) {
      return childVal
    }
    // when parentVal & childVal are both present,
    // we need to return a function that returns the
    // merged result of both functions... no need to
    // check if parentVal is a function here because
    // it has to be a function to pass previous merges.
    return function mergedDataFn () {
      return mergeData(
        typeof childVal === 'function' ? childVal.call(this, this) : childVal,
        typeof parentVal === 'function' ? parentVal.call(this, this) : parentVal
      )
    }
  } else {//vue实例  new
    return function mergedInstanceDataFn () {
      // instance merge
      const instanceData = typeof childVal === 'function'
        ? childVal.call(vm, vm)
        : childVal
      const defaultData = typeof parentVal === 'function'
        ? parentVal.call(vm, vm)
        : parentVal
      if (instanceData) {
        return mergeData(instanceData, defaultData)
      } else {
        return defaultData
      }
    }
  }
}
// 对于 el、propsData 选项使用默认的合并策略 defaultStrat。
// 对于 data 选项，使用 mergeDataOrFn 函数进行处理，最终结果是 data 选项将变成一个函数，且该函数的执行结果为真正的数据对象。
// 对于 生命周期钩子 选项，将合并成数组，使得父子选项中的钩子函数都能够被执行
// 对于 directives、filters 以及 components 等资源选项，父子选项将以原型链的形式被处理，正是因为这样我们才能够在任何地方都使用内置组件、指令等。
// 对于 watch 选项的合并处理，类似于生命周期钩子，如果父子选项都有相同的观测字段，将被合并为数组，这样观察者都将被执行。
// 对于 props、methods、inject、computed 选项，父选项始终可用，但是子选项会覆盖同名的父选项字段。
// 对于 provide 选项，其合并策略使用与 data 选项相同的 mergeDataOrFn 函数。
// 最后，以上没有提及到的选项都将使默认选项 defaultStrat。
// 最最后，默认合并策略函数 defaultStrat 的策略是：只要子选项不是 undefined 就使用子选项，否则使用父选项。
// 选项 data 的合并策略
strats.data = function (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  if (!vm) {//子组件
    if (childVal && typeof childVal !== 'function') {
      process.env.NODE_ENV !== 'production' && warn(
        'The "data" option should be a function ' +
        'that returns a per-instance value in component ' +
        'definitions.',
        vm
      )

      return parentVal
    }
    return mergeDataOrFn(parentVal, childVal)
  }

  return mergeDataOrFn(parentVal, childVal, vm)
}

/**
 * Hooks and props are merged as arrays.
 * 合并挂钩
 */
function mergeHook (
  parentVal: ?Array<Function>,
  childVal: ?Function | ?Array<Function>
): ?Array<Function> {
  const res = childVal//是否有 childVal，即判断组件的选项中是否有对应名字的生命周期钩子函数
    ? parentVal//如果有 childVal 则判断是否有 parentVal
      ? parentVal.concat(childVal)//如果有 parentVal 则使用 concat 方法将二者合并为一个数组
      : Array.isArray(childVal)//如果没有 parentVal 则判断 childVal 是不是一个数组
        ? childVal//如果 childVal 是一个数组则直接返回
        : [childVal]//否则将其作为数组的元素，然后返回数组
    : parentVal//如果没有 childVal 则直接返回 parentVal
  return res
    ? dedupeHooks(res)
    : res
}

function dedupeHooks (hooks) {
  const res = []
  for (let i = 0; i < hooks.length; i++) {
    if (res.indexOf(hooks[i]) === -1) {
      res.push(hooks[i])
    }
  }
  return res
}
//生命周期挂钩  在 strats 策略对象上添加用来合并各个生命周期钩子选项的策略函数
LIFECYCLE_HOOKS.forEach(hook => {
  strats[hook] = mergeHook
})

/**
 * Assets
 *
 * When a vm is present (instance creation), we need to do
 * a three-way merge between constructor options, instance
 * options and parent options.
 */
function mergeAssets (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): Object {
  const res = Object.create(parentVal || null)
  if (childVal) {
    process.env.NODE_ENV !== 'production' && assertObjectType(key, childVal, vm) //检测 childVal 是不是一个纯对象的，如果不是纯对象会给你一个警告
    return extend(res, childVal)
  } else {
    return res
  }
}
//directives、filters 以及 components合并策略 
ASSET_TYPES.forEach(function (type) {
  strats[type + 's'] = mergeAssets
})

/**
 * Watchers.
 *
 * Watchers hashes should not overwrite one
 * another, so we merge them as arrays.
 * 选项 watch 的合并策略
 */
strats.watch = function (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): ?Object {
  // work around Firefox's Object.prototype.watch...
  // Firefox 浏览器中 Object.prototype 拥有原生的 watch 函数  容易造成冲突
  // 在发现watch为浏览器原生函数时重置
  if (parentVal === nativeWatch) parentVal = undefined
  if (childVal === nativeWatch) childVal = undefined
  /* istanbul ignore if */
  if (!childVal) return Object.create(parentVal || null)
  if (process.env.NODE_ENV !== 'production') {//检测其是否是一个纯对象
    assertObjectType(key, childVal, vm)
  }
  if (!parentVal) return childVal
  const ret = {}
  // 将 parentVal 的属性混合到 ret 中，后面处理的都将是 ret 对象，最后返回的也是 ret 对象
  extend(ret, parentVal)
  for (const key in childVal) {
    // 由于遍历的是 childVal，所以 key 是子选项的 key，父选项中未必能获取到值，所以 parent 未必有值
    let parent = ret[key]
    // child 是肯定有值的，因为遍历的就是 childVal 本身
    const child = childVal[key]
    // 这个 if 分支的作用就是如果 parent 存在，就将其转为数组
    if (parent && !Array.isArray(parent)) {
      parent = [parent]
    }
    ret[key] = parent
      // 最后，如果 parent 存在，此时的 parent 应该已经被转为数组了，所以直接将 child concat 进去
      ? parent.concat(child)
      // 如果 parent 不存在，直接将 child 转为数组返回
      : Array.isArray(child) ? child : [child]
  }
  return ret
}

/**
 * Other object hashes.
 * 选项 props、methods、inject、computed 的合并策略
 */
strats.props =
strats.methods =
strats.inject =
strats.computed = function (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): ?Object {
  // 如果存在 childVal，那么在非生产环境下要检查 childVal 的类型
  if (childVal && process.env.NODE_ENV !== 'production') {
    assertObjectType(key, childVal, vm)
  }
  if (!parentVal) return childVal
  // 如果 parentVal 存在，则创建 ret 对象，然后分别将 parentVal 和 childVal 的属性混合到 ret 中
  // 注意：由于 childVal 将覆盖 parentVal 的同名属性
  const ret = Object.create(null)
  extend(ret, parentVal)
  if (childVal) extend(ret, childVal)
  // 最后返回 ret 对象。
  return ret
}
strats.provide = mergeDataOrFn

/**
 * Default strategy.
 */
const defaultStrat = function (parentVal: any, childVal: any): any {
  return childVal === undefined
    ? parentVal
    : childVal
}

/**
 * Validate component names
 * 校验组件的名字是否符合要求
 */
function checkComponents (options: Object) {
  // 变量options.components  依次校验
  for (const key in options.components) {
    validateComponentName(key)
  }
}

export function validateComponentName (name: string) {
  if (!new RegExp(`^[a-zA-Z][\\-\\.0-9_${unicodeRegExp.source}]*$`).test(name)) {
    warn(
      'Invalid component name: "' + name + '". Component names ' +
      'should conform to valid custom element name in html5 specification.'
    )
  }
  // isBuiltInTag 方法的作用是用来检测你所注册的组件是否是内置的标签  与内置标签重名
  // 判断一个标签是否是保留标签，我们可以知道，如果一个标签是 html 标签，或者是 svg 标签，那么这个标签即是保留标签
  if (isBuiltInTag(name) || config.isReservedTag(name)) {
    warn(
      'Do not use built-in or reserved HTML elements as component ' +
      'id: ' + name
    )
  }
}

/**
 * Ensure all props option syntax are normalized into the
 * Object-based format.
 */
function normalizeProps (options: Object, vm: ?Component) {
  const props = options.props//获取props属性
  if (!props) return
  const res = {}
  let i, val, name
  if (Array.isArray(props)) {//props是数组形式
    i = props.length
    while (i--) {
      val = props[i]
      if (typeof val === 'string') {
        // 作用是将中横线转驼峰
        name = camelize(val)
        res[name] = { type: null }
      } else if (process.env.NODE_ENV !== 'production') {
        warn('props must be strings when using array syntax.')
      }
    }
  } else if (isPlainObject(props)) {//props是对象
    for (const key in props) {
      val = props[key]
      name = camelize(key)
      res[name] = isPlainObject(val)
        ? val
        : { type: val }
    }
  } else if (process.env.NODE_ENV !== 'production') {
    warn(
      `Invalid value for option "props": expected an Array or an Object, ` +
      `but got ${toRawType(props)}.`,
      vm
    )
  }
  options.props = res
}

/**
 * Normalize all injections into Object-based format
 */
function normalizeInject (options: Object, vm: ?Component) {
  const inject = options.inject
  if (!inject) return
  // 重写了一个inject  初始值为空对象
  const normalized = options.inject = {}
  if (Array.isArray(inject)) {//数组
    for (let i = 0; i < inject.length; i++) {
      // ['data']
      // {
      //   data: {
      //     from: 'data'
      //   }
      // }
      normalized[inject[i]] = { from: inject[i] }
    }
  } else if (isPlainObject(inject)) {//对象
    for (const key in inject) {
      // {
      //   data: 'data',
      //   data: {
      //     state: true
      //   }
      // }
      // {
      //   data:{
      //     from: 'data'
      //   },
      //   data:{
      //     from: 'data',
      //     state: true
      //   }
      // }
      const val = inject[key]
      normalized[key] = isPlainObject(val)
        ? extend({ from: key }, val)
        : { from: val }
    }
  } else if (process.env.NODE_ENV !== 'production') {
    warn(
      `Invalid value for option "inject": expected an Array or an Object, ` +
      `but got ${toRawType(inject)}.`,
      vm
    )
  }
}

/**
 * Normalize raw function directives into object format.
 */
function normalizeDirectives (options: Object) {
  const dirs = options.directives
  if (dirs) {
    for (const key in dirs) {
      const def = dirs[key]
      if (typeof def === 'function') {
        dirs[key] = { bind: def, update: def }
      }
    }
  }
}

function assertObjectType (name: string, value: any, vm: ?Component) {
  if (!isPlainObject(value)) {
    warn(
      `Invalid value for option "${name}": expected an Object, ` +
      `but got ${toRawType(value)}.`,
      vm
    )
  }
}

/**
 * Merge two option objects into a new one. 将两个选项对象合并为一个新对象。
 * Core utility used in both instantiation and inheritance.  这个函数在实例化和继承的时候都有用到
 * 注意两点：
 *     第一，这个函数将会产生一个新的对象；
 *     第二，这个函数不仅仅在实例化对象(即_init方法中)的时候用到，在继承(Vue.extend)中也有用到，
 * 所以这个函数应该是一个用来合并两个选项对象为一个新对象的通用程序
 */
export function mergeOptions (
  parent: Object,
  child: Object,
  // 如果策略函数中拿不到 vm 参数，那么处理的就是子组件的选项
  vm?: Component
): Object {
  // 在非生产环境下，会以 child 为参数调用 checkComponents 方法 检验组件名是否合理
  if (process.env.NODE_ENV !== 'production') {
    checkComponents(child)
  }

  // child也可能是个函数
  // Vue构造函数本身或由Vue.extend()创造出来的子类都有options这个属性
  if (typeof child === 'function') {
    child = child.options
  }

  // 规范化 props
  // 将不同形式的props都转换成同一种对象形式的props  方便处理
  normalizeProps(child, vm)
  // 规范化 inject
  normalizeInject(child, vm)
  // 规范化 directives
  normalizeDirectives(child)

  // Apply extends and mixins on the child options,对子选项应用扩展和混合
  // but only if it is a raw options object that isn't但前提是它是一个原始的Options对象，该对象不是
  // the result of another mergeOptions call.另一个合并选项调用的结果
  // Only merged options has the _base property.只有合并的选项具有_base属性。
  if (!child._base) {
    if (child.extends) {
      parent = mergeOptions(parent, child.extends, vm)
    }
    if (child.mixins) {
      for (let i = 0, l = child.mixins.length; i < l; i++) {
        parent = mergeOptions(parent, child.mixins[i], vm)
      }
    }
  }

  // Vue 选项的合并
  const options = {}
  let key
  // Vue.options = { 假如parent就是Vue.options
  //   components: {
  //       KeepAlive,
  //       Transition,
  //       TransitionGroup
  //   },
  //   directives:{
  //       model,
  //       show
  //   },
  //   filters: Object.create(null),
  //   _base: Vue
  // }
  for (key in parent) {
    mergeField(key)
  }
  for (key in child) {
    // 其作用是用来判断一个属性是否是对象自身的属性 避免重复调用
    if (!hasOwn(parent, key)) {
      mergeField(key)
    }
  }
  function mergeField (key) {
    // const strats = config.optionMergeStrategies
    // 选项覆盖策略是处理如何将父选项值和子选项值合并到最终值的函数
    // 也就是说 config.optionMergeStrategies 是一个合并选项的策略对象，这个对象下包含很多函数，这些函数就可以认为是合并特定选项的策略
    // 这样不同的选项使用不同的合并策略，如果你使用自定义选项，那么你也可以自定义该选项的合并策略，只需要在 Vue.config.optionMergeStrategies 对象上添加与自定义选项同名的函数就行
    // 而这就是 Vue 文档中提过的全局配置：optionMergeStrategies
    // config.optionMergeStrategies先判断是否有该策略  若没有则查找child有无该策略  没有则使用parent策略
    const strat = strats[key] || defaultStrat
    options[key] = strat(parent[key], child[key], vm, key)
  }
  return options
}

/**
 * Resolve an asset.
 * This function is used because child instances need access
 * to assets defined in its ancestor chain.
 */
export function resolveAsset (
  options: Object,
  type: string,
  id: string,
  warnMissing?: boolean
): any {
  /* istanbul ignore if */
  if (typeof id !== 'string') {
    return
  }
  const assets = options[type]
  // check local registration variations first
  if (hasOwn(assets, id)) return assets[id]
  const camelizedId = camelize(id)
  if (hasOwn(assets, camelizedId)) return assets[camelizedId]
  const PascalCaseId = capitalize(camelizedId)
  if (hasOwn(assets, PascalCaseId)) return assets[PascalCaseId]
  // fallback to prototype chain
  const res = assets[id] || assets[camelizedId] || assets[PascalCaseId]
  if (process.env.NODE_ENV !== 'production' && warnMissing && !res) {
    warn(
      'Failed to resolve ' + type.slice(0, -1) + ': ' + id,
      options
    )
  }
  return res
}
