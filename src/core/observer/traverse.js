/* @flow */

import { _Set as Set, isObject } from '../util/index'
import type { SimpleSet } from '../util/index'
import VNode from '../vdom/vnode'

const seenObjects = new Set()

/**
 * Recursively traverse an object to evoke all converted
 * getters, so that every nested property inside the object
 * is collected as a "deep" dependency.
 */
// 深度观测
export function traverse (val: any) {
  _traverse(val, seenObjects)
  seenObjects.clear()
}

// 第一个参数是被观察属性的值，第二个参数是一个 Set 数据结构的实例
function _traverse (val: any, seen: SimpleSet) {
  let i, keys
  // 检查参数 val 是不是数组
  const isA = Array.isArray(val)
  // 要么是一个对象要么是一个数组，并且该值不能是冻结的，同时也不应该是 VNode 实例
  // 只有当被观察属性的值满足这些条件时，才会对其进行深度观测
  if ((!isA && !isObject(val)) || Object.isFrozen(val) || val instanceof VNode) {
    return
  }
  // 如果被观察属性的值 val 是一个循环引用的对象，那么上面的代码将导致死循环，
  // 为了避免这种情况的发生，我们可以使用一个变量来存储那些已经被遍历过的对象，
  // 当再次遍历该对象时程序会发现该对象已经被遍历过了，这时会跳过遍历，从而避免死循环
  // 如果一个响应式数据是对象或数组，那么它会包含一个叫做 __ob__ 的属性
  if (val.__ob__) {
    // 读取 val.__ob__.dep.id 作为一个唯一的ID值
    const depId = val.__ob__.dep.id
    // 如果seen中已有该id则结束此次循环，否则继续
    if (seen.has(depId)) {
      return
    }
    seen.add(depId)
  }
  //数组
  if (isA) {
    // 通过 while 循环对其进行遍历，并递归调用 _traverse 函数
    i = val.length
    while (i--) _traverse(val[i], seen)
  } else {
    // 对象
    keys = Object.keys(val)
    i = keys.length
    while (i--) _traverse(val[keys[i]], seen)
  }
}
