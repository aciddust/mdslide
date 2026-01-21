const plugin = require('prettier-plugin-svelte');
console.log('printer keys:', Object.keys(plugin.printers['svelte-ast']));
console.log('embed has getVisitorKeys:', !!plugin.printers['svelte-ast'].embed.getVisitorKeys);
console.log('typeof getVisitorKeys:', typeof plugin.printers['svelte-ast'].embed.getVisitorKeys);
console.log('getVisitorKeys returns for node:', plugin.printers['svelte-ast'].getVisitorKeys ? 'printer.getVisitorKeys exists' : 'printer.getVisitorKeys missing');
