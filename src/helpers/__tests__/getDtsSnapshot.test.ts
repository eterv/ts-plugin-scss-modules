import { readFileSync } from 'fs';
import { join } from 'path';
import postcssImportSync from 'postcss-import-sync2';
import tsModule from 'typescript/lib/tsserverlibrary';
import { CSSExportsWithSourceMap, getCssExports } from '../getCssExports';
import { createDtsExports } from '../createDtsExports';
import { Logger } from '../logger';
import { getProcessor } from '../getProcessor';
import { Options } from '../../options';

const testFileNames = [
  'test.module.css',
  'test.module.scss',
  'test.module.sass',
  'empty.module.sass',
  'empty.module.scss',
  'import.module.css',
];

const logger: Logger = {
  log: jest.fn(),
  error: jest.fn(),
};

const options: Options = {};

const compilerOptions: tsModule.CompilerOptions = {};

const processor = getProcessor([
  // For testing PostCSS import support/functionality.
  postcssImportSync(),
]);

describe('utils / cssSnapshots', () => {
  testFileNames.forEach((testFile) => {
    let cssExports: CSSExportsWithSourceMap;
    const fileName = join(__dirname, 'fixtures', testFile);
    const css = readFileSync(fileName, 'utf8');

    beforeAll(() => {
      cssExports = getCssExports({
        css,
        fileName,
        logger,
        options,
        processor,
        compilerOptions,
      });
    });

    describe(`with file '${testFile}'`, () => {
      describe('getCssExports', () => {
        it('should return an object matching expected CSS', () => {
          expect(getCssExports).toMatchSnapshot();
        });
      });

      describe('createExports', () => {
        it('should create an exports file', () => {
          const dts = createDtsExports({
            cssExports,
            fileName,
            logger,
            options: {},
          });
          expect(dts).toMatchSnapshot();
        });
      });

      describe('with a custom template', () => {
        it('should transform the generated dts', () => {
          const customTemplate = join(
            __dirname,
            'fixtures',
            'customTemplate.js',
          );

          const options: Options = { customTemplate };

          const dts = createDtsExports({
            cssExports,
            fileName,
            logger,
            options,
          });
          expect(dts).toMatchSnapshot();
        });
      });
    });
  });

  describe('with a Bootstrap import', () => {
    const fileName = join(__dirname, 'fixtures', 'bootstrap.module.scss');
    const css = readFileSync(fileName, 'utf8');

    it('should find external files', () => {
      const cssExports = getCssExports({
        css,
        fileName,
        logger,
        options,
        processor,
        compilerOptions,
      });

      expect(cssExports.classes.test).toMatchSnapshot();
    });
  });

  describe('with a custom renderer', () => {
    const fileName = 'exampleFileContents';
    const css = 'exampleFileName';
    const customRenderer = join(__dirname, 'fixtures', 'customRenderer.js');

    const options: Options = { customRenderer };

    it('should process a file and log', () => {
      const cssExports = getCssExports({
        css,
        fileName,
        logger,
        options,
        processor,
        compilerOptions,
      });

      expect(cssExports.classes).toMatchSnapshot();
      expect(logger.log).toHaveBeenCalledWith('Example log');
    });
  });

  describe('with loadPaths in sass options', () => {
    const fileName = join(__dirname, 'fixtures', 'include-path.module.scss');
    const css = readFileSync(fileName, 'utf8');

    const options: Options = {
      rendererOptions: {
        sass: { loadPaths: [join(__dirname, 'external')] },
      },
    };

    it('should find external file from loadPaths', () => {
      const cssExports = getCssExports({
        css,
        fileName,
        logger,
        options,
        processor,
        compilerOptions,
      });

      expect(cssExports.classes).toMatchSnapshot();
    });
  });

  describe('with baseUrl and paths in compilerOptions', () => {
    const fileName = join(__dirname, 'fixtures', 'tsconfig-paths.module.scss');
    const css = readFileSync(fileName, 'utf8');
    const compilerOptions = {
      baseUrl: __dirname,
      paths: {
        '@scss/*': ['external/package/*'],
        'alias.scss': ['external/package/public.module.scss'],
      },
    };

    it('sass should find the files', () => {
      const cssExports = getCssExports({
        css,
        fileName,
        logger,
        options,
        processor,
        compilerOptions,
      });

      expect(cssExports.classes).toMatchSnapshot();
    });
  });

  describe('with goToDefinition enabled', () => {
    const fileName = join(__dirname, 'fixtures', 'test.module.scss');
    const css = readFileSync(fileName, 'utf8');
    const options: Options = {
      classnameTransform: 'camelCaseOnly',
      goToDefinition: true,
    };

    const cssExports = getCssExports({
      css,
      fileName,
      logger,
      options,
      processor,
      compilerOptions,
    });

    it('should return an object with classes, css, and a source map', () => {
      expect(cssExports).toMatchSnapshot();
    });

    it.only('should return a line-accurate dts file', () => {
      const dts = createDtsExports({
        cssExports,
        fileName,
        logger,
        options,
      });
      expect(dts).toMatchSnapshot();
    });
  });
});
