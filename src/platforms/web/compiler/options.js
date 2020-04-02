/* @flow */

import {
  isPreTag,
  mustUseProp,
  isReservedTag,
  getTagNamespace
} from '../util/index'

import modules from './modules/index'
import directives from './directives/index'
import { genStaticKeys } from 'shared/util'
import { isUnaryTag, canBeLeftOpenTag } from './util'

export const baseOptions: CompilerOptions = {
  expectHTML: true,
  // 是一个数组，数组有三个元素 klass、style 以及 model
  modules,
  // 它是一个包含三个属性model,text,html的对象，且属性的值都是函数
  directives,
  // 是一个函数，作用是通过给定的标签名字检查标签是否是 'pre' 标签
  isPreTag,
  // 是一个通过 makeMap 生成的函数，该函数的作用是检测给定的标签是否是一元标签
  isUnaryTag,
  // 作用是用来检测一个属性在标签中是否要使用 props 进行绑定
  mustUseProp,
  // 检测一个标签是否是那些虽然不是一元标签，但却可以自己补全并闭合的标签，比如 p 标签，可以<p>xxx<p> 也可以<p>xxx由浏览器补全
  canBeLeftOpenTag,
  // 检查给定的标签是否是保留的标签
  isReservedTag,
  // 获取元素(标签)的命名空间
  getTagNamespace, 
  // 调用 genStaticKeys 函数的返回值得到的  根据编译器选项的 modules 选项生成一个静态键字符串
  staticKeys: genStaticKeys(modules)
}
