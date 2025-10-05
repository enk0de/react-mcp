import type { NodePath, PluginObj } from '@babel/core';
import type * as BabelTypes from '@babel/types';

interface PluginState {
  file: {
    opts: {
      filename?: string;
    };
  };
}

export default function ({
  types: t,
}: {
  types: typeof BabelTypes;
}): PluginObj<PluginState> {
  return {
    name: 'react-source-location',
    visitor: {
      JSXElement(path: NodePath<BabelTypes.JSXElement>, state: PluginState) {
        const { node } = path;
        const { filename } = state.file.opts;
        const { line, column } = node.loc?.start || { line: 0, column: 0 };

        console.log(
          '[Babel Plugin] Found JSX Element at',
          filename,
          'line',
          line,
        );

        // 이미 __source가 있는지 확인
        const openingElement = node.openingElement;
        const hasSource = openingElement.attributes.some(
          (attr) =>
            t.isJSXAttribute(attr) &&
            t.isJSXIdentifier(attr.name) &&
            attr.name.name === '__componentSource',
        );

        console.log({
          hasSource,
          openingElement,
        });

        // __source 속성 생성
        const sourceAttr = t.jsxAttribute(
          t.jsxIdentifier('__componentSource'),
          t.jsxExpressionContainer(
            t.objectExpression([
              t.objectProperty(
                t.identifier('fileName'),
                t.stringLiteral(filename || 'unknown'),
              ),
              t.objectProperty(
                t.identifier('lineNumber'),
                t.numericLiteral(line),
              ),
              t.objectProperty(
                t.identifier('columnNumber'),
                t.numericLiteral(column),
              ),
            ]),
          ),
        );

        if (!hasSource) {
          openingElement.attributes.push(sourceAttr);
          console.log('[Babel Plugin] Added __source to JSX element');
        }
      },
    },
  };
}
