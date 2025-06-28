const webpack = require('webpack');

module.exports = function override(config, env) {
  if (env === 'production') {
    // Remove CSS optimization to avoid the css-what issue
    config.optimization = {
      ...config.optimization,
      minimizer: config.optimization.minimizer.filter(plugin => 
        plugin.constructor.name !== 'CssMinimizerPlugin'
      )
    };
  }
  return config;
};