/* @flow */

import { cached } from 'shared/util'
import { parseFilters } from './filter-parser'
import { parse } from 'acorn'

const defaultTagRE = /\{\{((?:.|\n)+?)\}\}/g
const bracketInBracketTagRE = /\{\{((['"][^'"]+['"]|[^{}]+)+)\}\}/g
const regexEscapeRE = /[-.*+?^${}()|[\]\/\\]/g

const buildRegex = cached(delimiters => {
  const open = delimiters[0].replace(regexEscapeRE, '\\$&')
  const close = delimiters[1].replace(regexEscapeRE, '\\$&')
  return new RegExp(open + '((?:.|\\n)+?)' + close, 'g')
})

export function parseText (
  text: string,
  delimiters?: [string, string]
): string | void {
  // const tagRE = delimiters ? buildRegex(delimiters) : defaultTagRE
  const tagRE = delimiters ? buildRegex(delimiters) : bracketInBracketTagRE
  if (!tagRE.test(text)) {
    return `[3, ${JSON.stringify(text)}]`
  }
  const tokens = []
  let lastIndex = (tagRE.lastIndex = 0)
  let match, index
  while ((match = tagRE.exec(text))) {
    index = match.index
    // push text token
    if (index > lastIndex) {
      tokens.push(`[3, ${JSON.stringify(text.slice(lastIndex, index))}]`)
    }
    // tag token
    const exp = parseExp(match[1].trim()) || ''
    tokens.push(exp)
    lastIndex = index + match[0].length
  }
  if (lastIndex < text.length) {
    tokens.push(`[3, ${JSON.stringify(text.slice(lastIndex))}]`)
  }

  if (tokens.length > 1) {
    return `[a, ${tokens.join(',')}]`
  } else {
    return tokens.join('')
  }
}

export function walk (node: AcornNode | void, inMember?:boolean): string {
  let res = 'Unknown Type'
  if (node) {
    switch (node.type) {
      case 'LogicalExpression':
        if (node.operator && node.left) {
          res = `[[2, "${node.operator}"],${walk(node.left)},${walk(node.right)}]`
        }
        break
      case 'BinaryExpression':
        if (node.operator) {
          res = `[[2, "${node.operator}"], ${walk(node.left)}, ${walk(node.right)}]`
        }
        break
      case 'Identifier':
        if (node.name) {
         if(inMember) {
           res = `[3, "${node.name}"]`
         } else {
           res = `[[7],[3, "${node.name}"]]`
         }
        }
        break
      case 'UnaryExpression':
        if (node.operator) {
          res = `[[2, "${node.operator}"], ${walk(node.argument)}]`
        }
        break
      case 'Literal':
        if (node.raw) res = `[1, ${node.raw}]`
        break
      case 'ArrayExpression':
        if (node.elements) {
          res = `[[4], ${node.elements.reduce((p, c) => `[[5], ${p} ${p && ','} ${walk(c)}]`, '')}]`
        }
        break
      case 'ConditionalExpression':
        res = `[[2,'?:'],${walk(node.test)},${walk(node.consequent)},${walk(node.alternate)}]`
        break
      case 'MemberExpression':
        res = `[[6],${walk(node.object)},${walk(node.property, true)}]`
        break
      default:
        console.log(`${res}: ${node.type}`)
    }
  }
  return res
}

export function walkExp (ast: Object, type: number): string {
  if (type === 0) {
    return walk(ast.body[0].expression)
  } else if (type === 1) {
  }

  return JSON.stringify(ast)
}

export function parseExp (text: string): string | void {
  let ast: AcornNode
  try {
    // normal exporession
    ast = parse(text)
    return walkExp(ast, 0)
  } catch (e) {
    try {
      // object expression
      ast = parse(`x={${text}}`)
      return walkExp(ast, 1)
    } catch (e) {
      throw new Error(`${text} contains syntax errs`)
    }
  }
}
