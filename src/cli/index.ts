import { runCli } from './commands';

runCli().then((exitCode) => {
  process.exitCode = exitCode;
});
