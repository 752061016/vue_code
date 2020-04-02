/* @flow */

import { warn } from './debug'
import { observe, toggleObserving, shouldObserve } from '../observer/index'
import {
  hasOwn,
  isObject,
  toRawType,
  hyphenate,
  capitalize,
  isPlainObject
} from 'shared/util'

type PropOptions = {
  type: Function | Array<Function> | null,
  default: any,
  required: ?boolean,
  validator: ?Function
};

export function validateProp (
  key: string,
  propOptions: Object,
  propsData: Object,
  vm?: Component
): any {
  // 名字为 key 的 props 的定义 包含type等
  const prop = propOptions[key]
  // 代表着对应的 prop 在 propsData 上是否有数据 如果 absent 为真，则代表 prop 数据缺失
  const absent = !hasOwn(propsData, key)
  // 通过读取 propsData 得到的，当然了如果外界没有向组件传递相应的 prop 数据，那么 value 就是 undefined
  let value = propsData[key]
  // boolean casting
  const booleanIndex = getTypeIndex(Boolean, prop.type)
  // 以下是对 prop 的类型为布尔值时的特殊处理
  if (booleanIndex > -1) {// 定义 props 时指定了 Boolean 类型
    // 外界没有为组件传递该 prop，并且该 prop 也没有指定默认值
    // 上述情况下如果你指定该 prop 的类型为 Boolean，那么 Vue 会自动将该 prop 的值设置为 false
    if (absent && !hasOwn(prop, 'default')) {
      value = false
      // prop 要么是一个空字符串，要么就是一个名字由驼峰转连字符后与值为相同字符串的 prop
    } else if (value === '' || value === hyphenate(key)) {
      // only cast empty string / same name to boolean if
      // boolean has higher priority
      // String 类型在 prop 类型定义中的位置
      const stringIndex = getTypeIndex(String, prop.type)
      // 如果 stringIndex < 0 则说明没有为该 prop 指定 String 类型
      // 否则说明为 prop 指定了 String 类型，但由于之前的判断能够确定的是已经为 prop 指定了 Boolean 类型，那么说明此时至少为该 prop 指定了两种类型：String 和 Boolean
      // 这时会将 booleanIndex 与 stringIndex 作比较，比较的目的是检测 String 和 Boolean 这两个类型谁定义在前面
      // 1、没有定义 String 类型
      // 2、虽然定义了 String 类型，但是 String 类型的优先级没有 Boolean 高
      if (stringIndex < 0 || booleanIndex < stringIndex) {
        // 会将该 prop 的值设置为 true，而非字符串
        value = true
      }
    }
  }
  // check default value
  // 检测该 prop 的值是否是 undefined 外界未指定props的值  则使用内部的默认值赋值
  if (value === undefined) {
    // 返回内部指定的对象中default的默认值  并赋值给value
    value = getPropDefaultValue(vm, prop, key)
    // since the default value is a fresh copy,
    // make sure to observe it.
    // 使用 prevShouldObserve 常量保存了之前的 shouldObserve 状态 数据是否需要响应式
    const prevShouldObserve = shouldObserve
    // 打开开关 ==> shouldObserve = true
    toggleObserving(true)
    // 使value成为响应式数据
    observe(value)
    // 还原开关shouldObserve的状态
    toggleObserving(prevShouldObserve)
  }
  // 用来对 props 的类型做校验的
  if (
    process.env.NODE_ENV !== 'production' &&
    // skip validation for weex recycle-list child component props
    // 用来跳过 weex 环境下某种条件的判断
    !(__WEEX__ && isObject(value) && ('@binding' in value))
  ) {
    // 校验工作是由 assertProp 函数完成
    assertProp(prop, key, value, vm, absent)
  }
  return value
}

/**
 * Get the default value of a prop.
 */
function getPropDefaultValue (vm: ?Component, prop: PropOptions, key: string): any {
  // no default, return undefined
  if (!hasOwn(prop, 'default')) {
    return undefined
  }
  const def = prop.default
  // warn against non-factory defaults for Object & Array
  // 默认值不允许为对象或数组，会打印错误信息
  if (process.env.NODE_ENV !== 'production' && isObject(def)) {
    warn(
      'Invalid default value for prop "' + key + '": ' +
      'Props with type Object/Array must use a factory function ' +
      'to return the default value.',
      vm
    )
  }
  // the raw prop value was also undefined from previous render,
  // return previous default value to avoid unnecessary watcher trigger
  // 是为组件更新时准备的：vm.$options.propsData 是上一次组件更新或创建时的数据
  // 1、当前组件处于更新状态，且没有传递该 prop 数据给组件
  // 2、上一次更新或创建时外界也没有向组件传递该 prop 数据
  // 3、上一次组件更新或创建时该 prop 拥有一个不为 undefined 的默认值
  if (vm && vm.$options.propsData &&
    vm.$options.propsData[key] === undefined && // 上一次组件更新或创建时外界就没有向组件传递该 prop 数据
    vm._props[key] !== undefined // 该 prop 存在非未定义的默认值
  ) {
    // 此时应该返回之前的 prop 值(即默认值)作为本次渲染该 prop 的默认值,避免触发没有意义的响应
    return vm._props[key]
  }

  // call factory function for non-Function types
  // a value is Function if its prototype is function even across different execution context
  return typeof def === 'function' && getType(prop.type) !== 'Function'// 指定了该prop 的默认值类型为函数类型
    ? def.call(vm)
    : def
}

/**
 * Assert whether a prop is valid.
 */
function assertProp (
  prop: PropOptions, // 该prop的定义对象
  name: string,      // prop 的键
  value: any,        // prop 的值
  vm: ?Component,    // 组件实例对象
  absent: boolean    // 外界是否未向组件传递 prop 数据
) {
  // prop.required 为true表示该值为必传值，但是外界却没有向组件传递该 prop 的值
  if (prop.required && absent) {
    warn(
      'Missing required prop: "' + name + '"',
      vm
    )
    return
  }
  // value 值为 null 或 undefined 且为必传值
  if (value == null && !prop.required) {
    return
  }
  // 作用是用来做类型断言，即判断外界传递的 prop 值的类型与期望的类型是否相符
  let type = prop.type
  // !type表示定义prop时并未规定类型，则如何类型都可  或者直接设置类型为true  这两种情况则不需要为prop做校验
  let valid = !type || type === true
  const expectedTypes = []
  if (type) {
    // 类型不为数组则也转换成数组形式
    if (!Array.isArray(type)) {
      type = [type]
    }
    for (let i = 0; i < type.length && !valid; i++) {
      // assertType 函数的返回值类型
      // assertType = {
      //   expectedType: 'String',  类型的字符串表示
      //   valid: true              代表了该 prop 值是否通过了校验
      // }
      const assertedType = assertType(value, type[i])
      expectedTypes.push(assertedType.expectedType || '')
      valid = assertedType.valid
    }
  }
  // 未通过校验
  if (!valid) {
    warn(
      getInvalidTypeMessage(name, value, expectedTypes),
      vm
    )
    return
  }
  // validator 属性指定一个校验函数实现自定义校验，该函数的返回值作为校验的结果
  const validator = prop.validator
  if (validator) {
    if (!validator(value)) {
      warn(
        'Invalid prop: custom validator check failed for prop "' + name + '".',
        vm
      )
    }
  }
}

const simpleCheckRE = /^(String|Number|Boolean|Function|Symbol)$/

function assertType (value: any, type: Function): {
  valid: boolean;
  expectedType: string;
} {
  let valid
  const expectedType = getType(type) //期望类型
  // true为'String'、'Number'、'Boolean'、'Function' 以及 'Symbol'这五种类型之一
  if (simpleCheckRE.test(expectedType)) {
    // 通过 typeof 操作符获取到 value 的类型字符串
    const t = typeof value
    // 如果全等则说明该 prop 的值与期望类型相同
    valid = t === expectedType.toLowerCase()
    // for primitive wrapper objects
    // valid不是上述五种类型之一并且是object类型
    if (!valid && t === 'object') {
      // 使用 instanceof 操作符判断 value 是否是 type 的实例
      valid = value instanceof type
    }

  } else if (expectedType === 'Object') {
    // 使用 isPlainObject 函数检查该 prop 值的有效性
    valid = isPlainObject(value)
  } else if (expectedType === 'Array') {
    valid = Array.isArray(value)
  } else {
    // 自定义类型，只需要检查值是否为该自定义类型构造函数的实例
    valid = value instanceof type
  }
  return {
    valid,
    expectedType
  }
}

/**
 * Use function string name to check built-in types,
 * because a simple equality check will fail when running
 * across different vms / iframes.
 */
// 简单的类型之间直接比较在不同的 iframes / vms 之间是不管用的，不同 iframes 之间的 Array 构造函数本身都是不相等的
function getType (fn) {
  // 接收一个函数作为参数，然后使用正则去匹配该函数 toString() 后的字符串，并捕获函数的名字，最后如果捕获成功则返回函数名字，否则返回空字符串
  const match = fn && fn.toString().match(/^\s*function (\w+)/)
  return match ? match[1] : ''
}
// 判断构造函数类型是否相同
function isSameType (a, b) {
  return getType(a) === getType(b)
}

// getTypeIndex 函数的返回值如果大于 -1，则说明给定的类型构造函数在期望的类型构造函数之中。
function getTypeIndex (type, expectedTypes): number {
  // expectedTypes 是否为数组，如果不是数组那说明是一个单一的类型构造函数
  if (!Array.isArray(expectedTypes)) {
    // 如果传递给 getTypeIndex 函数的两个参数类型相同，则返回数字 0，否则返回数字 -1。
    return isSameType(expectedTypes, type) ? 0 : -1
  }
  // 通过 for 循环遍历该数组中的每一个类型构造函数
  for (let i = 0, len = expectedTypes.length; i < len; i++) {
    // 如果二者相同则直接返回给定类型构造函数在 expectedTypes 数组中的位置
    if (isSameType(expectedTypes[i], type)) {
      return i
    }
  }
  return -1
}

function getInvalidTypeMessage (name, value, expectedTypes) {
  let message = `Invalid prop: type check failed for prop "${name}".` +
    ` Expected ${expectedTypes.map(capitalize).join(', ')}`
  const expectedType = expectedTypes[0]
  const receivedType = toRawType(value)
  const expectedValue = styleValue(value, expectedType)
  const receivedValue = styleValue(value, receivedType)
  // check if we need to specify expected value
  if (expectedTypes.length === 1 &&
      isExplicable(expectedType) &&
      !isBoolean(expectedType, receivedType)) {
    message += ` with value ${expectedValue}`
  }
  message += `, got ${receivedType} `
  // check if we need to specify received value
  if (isExplicable(receivedType)) {
    message += `with value ${receivedValue}.`
  }
  return message
}

function styleValue (value, type) {
  if (type === 'String') {
    return `"${value}"`
  } else if (type === 'Number') {
    return `${Number(value)}`
  } else {
    return `${value}`
  }
}

function isExplicable (value) {
  const explicitTypes = ['string', 'number', 'boolean']
  return explicitTypes.some(elem => value.toLowerCase() === elem)
}

function isBoolean (...args) {
  return args.some(elem => elem.toLowerCase() === 'boolean')
}
