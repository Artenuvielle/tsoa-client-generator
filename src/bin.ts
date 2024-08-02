#!/usr/bin/env node

import { program } from 'commander';
import { generateClient } from '.';

function main() {
  const options = program
    //.option('-e, --entry-file <path>', 'entry file of the tsoa app')
    .requiredOption('-g, --controller-path-globs <globs...>', 'glob patterns for finding tsoa controller classes')
    .requiredOption(
      '-o, --output-client-directory <path>',
      'path to the directory where the client should be generated in'
    )
    .showHelpAfterError()
    .parse()
    .opts();
  generateClient({
    //entryFile: options.entryFile,
    controllerPathGlobs: options.controllerPathGlobs,
    clientDirectory: options.outputClientDirectory,
  });
}

if (require.main === module) {
  main();
}
