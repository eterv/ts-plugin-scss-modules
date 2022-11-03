import path from 'path';
import Processor from 'postcss/lib/processor';
import sass from 'sass';
import { CSSExports, extractICSS } from 'icss-utils';
import { RawSourceMap } from 'source-map-js';
import tsModule from 'typescript/lib/tsserverlibrary';
import { createMatchPath } from 'tsconfig-paths';
import { sassTildeImporter } from '../importers/sassTildeImporter';
import { Options, CustomRenderer } from '../options';
import { Logger } from './logger';
import { pathToFileURL } from 'url';

export const enum FileType {
  css = 'css',
  sass = 'sass',
  scss = 'scss',
}

export const getFileType = (fileName: string): FileType => {
  if (fileName.endsWith('.css')) return FileType.css;
  if (fileName.endsWith('.sass')) return FileType.sass;
  return FileType.scss;
};

const getFilePath = (fileName: string) => path.dirname(fileName);

export interface CSSExportsWithSourceMap {
  classes: CSSExports;
  css?: string;
  sourceMap?: RawSourceMap;
}

export const getCssExports = ({
  css,
  fileName,
  logger,
  options,
  processor,
  compilerOptions,
}: {
  css: string;
  fileName: string;
  logger: Logger;
  options: Options;
  processor: Processor;
  compilerOptions: tsModule.CompilerOptions;
}): CSSExportsWithSourceMap => {
  try {
    const fileType = getFileType(fileName);
    const rendererOptions = options.rendererOptions || {};

    let transformedCss = '';
    let sourceMap: string | undefined;

    if (options.customRenderer) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const customRenderer = require(options.customRenderer) as CustomRenderer;
      transformedCss = customRenderer(css, {
        fileName,
        logger,
        compilerOptions,
      });
    } else if (fileType === FileType.sass || fileType === FileType.scss) {
      const filePath = getFilePath(fileName);
      const { loadPaths, ...sassOptions } = rendererOptions.sass || {};
      const { baseUrl, paths } = compilerOptions;
      const matchPath =
        baseUrl && paths ? createMatchPath(path.resolve(baseUrl), paths) : null;

      const aliasImporter: sass.FileImporter<'sync'> = {
        findFileUrl(url) {
          const newUrl =
            matchPath !== null
              ? matchPath(url, undefined, undefined, [
                  `.${FileType.sass}`,
                  `.${FileType.scss}`,
                ])
              : undefined;
          return newUrl ? pathToFileURL(newUrl) : null;
        },
      };

      const importers = [aliasImporter, sassTildeImporter];

      const result = sass.compile(fileName, {
        loadPaths: [filePath, 'node_modules', ...(loadPaths || [])],
        importers,
        sourceMap: true,
        ...sassOptions,
      });

      transformedCss = result.css.toString();
      sourceMap = JSON.stringify(result.sourceMap);
    } else {
      transformedCss = css;
    }

    const processedCss = processor.process(transformedCss, {
      from: fileName,
      map: {
        inline: false,
        prev: sourceMap,
      },
    });

    return {
      classes: processedCss.root
        ? extractICSS(processedCss.root).icssExports
        : {},
      css: processedCss.css,
      sourceMap: processedCss.map.toJSON(),
    };
  } catch (e: any) {
    logger.error(e);
    return { classes: {} };
  }
};
