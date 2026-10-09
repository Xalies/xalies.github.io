// Compatibility entry point; browser coverage follows the current planner workflow.
if(process.argv.includes('--vessels-only'))require('../vessels/test.cjs');
else if(process.argv.includes('--mounting-only'))require('./mounting.test.cjs');
else require('./planner.test.cjs');
