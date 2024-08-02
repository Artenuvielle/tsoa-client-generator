import { existsSync, readFileSync } from 'fs';
import { extname, join } from 'path';
import { createSourceFile, ScriptTarget, type SourceFile } from 'typescript';
import { sync } from 'glob';

export class SourceFileLoader {
  private static cachedSourceFiles: Record<string, { fileContents: string; sourceFile: SourceFile }> = {};
  private static instance?: SourceFileLoader = undefined;

  public static get(): SourceFileLoader {
    if (this.instance === undefined) {
      this.instance = new SourceFileLoader();
    }
    return this.instance;
  }

  private constructor() {}

  public load(path: string): SourceFile {
    if (!path.endsWith('.ts')) {
      if (existsSync(path + '.ts')) {
        path += '.ts';
      } else if (existsSync(join(path, 'index.ts'))) {
        path = join(path, 'index.ts');
      }
    }
    const cachedEntry = SourceFileLoader.cachedSourceFiles[path];
    if (cachedEntry !== undefined) return cachedEntry.sourceFile;

    const fileContents = readFileSync(path, 'utf-8');
    const sourceFile = createSourceFile(path, fileContents, ScriptTarget.Latest);
    SourceFileLoader.cachedSourceFiles[path] = { fileContents, sourceFile };
    return sourceFile;
  }

  public loadByGlobs(globs: string[]): SourceFile[] {
    const allFiles = globs.reduce((allDirs, dir) => allDirs.concat(sync(dir)), [] as string[]);
    return allFiles.filter((file) => extname(file) === '.ts').map(this.load);
  }
}
