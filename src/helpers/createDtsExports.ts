import { SourceMapConsumer } from 'source-map-js';
import { CustomTemplate, Options } from '../options';
import { transformClasses } from './classTransforms';
import { CSSExportsWithSourceMap } from './getCssExports';
import { VALID_VARIABLE_REGEXP } from './validVarRegexp';
import { Logger } from './logger';

const isValidVariable = (className: string) =>
  VALID_VARIABLE_REGEXP.test(className);

const classNameToProperty = (className: string) => `'${className}': string;`;
const classNameToNamedExport = (className: string) =>
  `export let ${className}: string;`;

const flattenClassNames = (
  previousValue: string[] = [],
  currentValue: string[],
) => previousValue.concat(currentValue);

export const createDtsExports = ({
  cssExports,
  fileName,
  logger,
  options,
}: {
  cssExports: CSSExportsWithSourceMap;
  fileName: string;
  logger: Logger;
  options: Options;
}): string => {
  const classes = cssExports.classes;

  const processedClasses = Object.keys(classes)
    .map(transformClasses(options.classnameTransform))
    .reduce(flattenClassNames, []);
  const filteredClasses = processedClasses
    .filter(isValidVariable)
    .map(classNameToNamedExport);

  let dts = `\
declare let classes: {
${processedClasses.map(classNameToProperty).join('\n  ')}
};
export default classes;
`;

  if (options.namedExports !== false && filteredClasses.length) {
    dts += filteredClasses.join('\n') + '\n';
  }

  if (options.goToDefinition) {
    if (!cssExports.sourceMap) return dts;

    // Create a new source map consumer.
    const sourceMapConsumer = new SourceMapConsumer(cssExports.sourceMap);

    // Split original CSS file into lines.
    const cssLines = cssExports.css?.split('\n') || [];

    // Create new equal size array of empty strings.
    const dtsLines = Array.from(Array(cssLines.length), () => [] as string[]);

    const processedClasses = Object.entries(classes)
      .map(([className, hashedClassName]) =>
        transformClasses(options.classnameTransform)(className).map(
          (className) => [className, hashedClassName],
        ),
      )
      .reduce((prev, curr) => prev.concat(curr), []);

    const filteredClasses = processedClasses.filter(([className]) =>
      isValidVariable(className as string),
    );

    filteredClasses.forEach(([className, hashedClassName]) => {
      const matchedLine = cssLines.findIndex((line) =>
        line.includes(hashedClassName),
      );
      const matchedColumn =
        matchedLine && cssLines[matchedLine].indexOf(hashedClassName);
      const { line: lineNumber } = sourceMapConsumer.originalPositionFor({
        // Lines start at 1, not 0.
        line: matchedLine >= 0 ? matchedLine + 1 : 1,
        column: matchedColumn >= 0 ? matchedColumn : 0,
      });

      const index = lineNumber ? lineNumber - 1 : 0;

      const prev = dtsLines[index];
      dtsLines[index] = prev == null ? [className] : [...prev, className];
    });

    dts = dtsLines
      .map((classNames) => {
        return classNames.reduce((prev, className) => {
          return `${prev}${classNameToNamedExport(className)}`;
        }, '');
      })
      .join('\n');
  }

  if (options.customTemplate) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const customTemplate = require(options.customTemplate) as CustomTemplate;
    return customTemplate(dts, {
      classes,
      fileName,
      logger,
    });
  }

  return dts;
};
