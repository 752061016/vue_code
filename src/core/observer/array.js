/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'

const arrayProto = Array.prototype
export const arrayMethods = Object.create(arrayProto)

const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 */
methodsToPatch.forEach(function (method) {
  // cache original method 缓存了数组原本的变异方法
  const original = arrayProto[method]
  def(arrayMethods, method, function mutator (...args) {
    // 使用 def 函数在 arrayMethods 上定义与数组变异方法同名的函数，在函数体内优先调用了缓存下来的数组变异方法
    // 并将数组原本变异方法的返回值赋值给 result 常量  保证了拦截函数的功能与数组原本变异方法的功能是一致的
    const result = original.apply(this, args)
    // 定义了 ob 常量，它是 this.__ob__ 的引用，其中 this 其实就是数组实例本身
    const ob = this.__ob__
    let inserted
    switch (method) {
      // 新增加的元素是非响应式的，所以我们需要获取到这些新元素，并将其变为响应式数据才行
      case 'push':
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
        break
    }
    // 调用 observeArray 函数对其进行观测
    if (inserted) ob.observeArray(inserted)
    // notify change
    // __ob__.dep 中收集了所有该对象(或数组)的依赖
    ob.dep.notify()
    return result
  })
})
