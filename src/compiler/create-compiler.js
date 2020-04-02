/* @flow */

import { extend } from 'shared/util'
import { detectErrors } from './error-detector'
import { createCompileToFunctionFn } from './to-function'

export function createCompilerCreator (baseCompile: Function): Function {
  return function createCompiler (baseOptions: CompilerOptions) {
    // 1、生成最终编译器选项 finalOptions
    // 2、对错误的收集
    // 3、调用 baseCompile 编译模板
    function compile (
      template: string,
      options?: CompilerOptions
    ): CompiledResult {
      // 通过 Object.create 函数以 baseOptions 为原型创建 finalOptions 常量
      // baseOptions 是在src/platforms/web/compiler/index.js 文件中调用 createCompiler 传递过来的参数
      const finalOptions = Object.create(baseOptions)
      // 收集错误和提醒
      const errors = []
      const tips = []

      let warn = (msg, range, tip) => {
        (tip ? tips : errors).push(msg)
      }

      // 检查 options 是否存在
      if (options) {
        if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
          // $flow-disable-line
          const leadingSpaceLength = template.match(/^\s*/)[0].length

          warn = (msg, range, tip) => {
            const data: WarningMessage = { msg }
            if (range) {
              if (range.start != null) {
                data.start = range.start + leadingSpaceLength
              }
              if (range.end != null) {
                data.end = range.end + leadingSpaceLength
              }
            }
            (tip ? tips : errors).push(data)
          }
        }
        // merge custom modules
        // 查找自定义的modules  再将其与baseOptions.modules混合
        if (options.modules) {
          finalOptions.modules =
            (baseOptions.modules || []).concat(options.modules)
        }
        // merge custom directives
        // 同上 合并默认的directives与自定义的directives
        if (options.directives) {
          finalOptions.directives = extend(
            Object.create(baseOptions.directives || null),
            options.directives
          )
        }
        // copy other options
        // 把options中除modules和directives外的属性全添加到finalOptions上
        for (const key in options) {
          if (key !== 'modules' && key !== 'directives') {
            finalOptions[key] = options[key]
          }
        }
      }

      finalOptions.warn = warn

      // trim()去除字符串的头尾空格
      // compile 函数对模板的编译是委托 baseCompile 完成的  src/compiler/index.js
      const compiled = baseCompile(template.trim(), finalOptions)
      if (process.env.NODE_ENV !== 'production') {
        detectErrors(compiled.ast, warn)
      }
      // 将收集到的错误(errors)和提示(tips)添加到 compiled 上并返回
      compiled.errors = errors
      compiled.tips = tips
      return compiled
    }
    // compile 函数生成的是字符串形式的代码，而 compileToFunctions 生成的才是真正可执行的代码
    return {
      compile,
      compileToFunctions: createCompileToFunctionFn(compile)
    }
  }
}
