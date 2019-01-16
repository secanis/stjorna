var webpack = require('webpack');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var CopyWebpackPlugin = require('copy-webpack-plugin');
var ExtractTextPlugin = require('extract-text-webpack-plugin');
var helpers = require('./helpers');

module.exports = {
  entry: {
    'polyfills': './src/polyfills.ts',
    'vendor': './src/vendor.ts',
    'app': './src/main.ts'
  },

  resolve: {
    extensions: ['.ts', '.js']
  },

  module: {
    rules: [
      {
        test: /\.ts$/,
        loaders: [
          {
            loader: 'ts-loader',
          }, 'angular2-template-loader'
          // use ts-load because of an existing issue in the awesome-typescript-loader
          // https://github.com/s-panferov/awesome-typescript-loader/issues/534
          // {
          //   loader: 'awesome-typescript-loader',
          //   options: { tsconfig: 'tsconfig.json' }
          // }, 'angular2-template-loader'
        ]
      },
      {
        test: /\.html$/,
        loader: 'html-loader'
      },
      {
        test: /\.(png|jpe?g|gif|svg|woff|woff2|ttf|eot)$/,
        loader: 'file-loader?name=assets/[name].[hash].[ext]'
      },
      {
        test: /\.css$/,
        exclude: helpers.root('src', 'app'),
        loader: ExtractTextPlugin.extract({ fallback: 'style-loader', use: 'css-loader?sourceMap' })
      },
      {
        test: /\.css$/,
        include: helpers.root('src', 'app'),
        loader: 'raw-loader'
      }
    ]
  },

  optimization: {
    splitChunks: {
      cacheGroups: {
        default: {
          minChunks: 3,
          priority: -20,
          reuseExistingChunk: true,
        },
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendor",
          chunks: "all"
        },
        app: {
          test: /[\\/]app[\\/]/,
          name: "app",
          chunks: "all"
        },
        polyfills: {
          test: /[\\/]polyfills[\\/]/,
          name: "polyfills",
          chunks: "all"
        }
      }
    }
  },

  plugins: [
    // Workaround for angular/angular#11580
    new webpack.ContextReplacementPlugin(
      // The (\\|\/) piece accounts for path separators in *nix and Windows
      /\@angular(\\|\/)core(\\|\/)esm5(\\|\/)fesm5/,
      helpers.root('./src'), // location of your src
      {} // a map of your routes
    ),
    new HtmlWebpackPlugin({
      title: 'STJ&Oacute;RNA - Comfortable Product Managment.',
      meta: {
        title: 'STJ&Oacute;RNA - Comfortable Product Managment.',
        author: 'secanis.ch',
        publisher: 'secanis.ch',
        copyright: 'secanis.ch',
        charset: 'UTF-8',
        viewport: 'width=device-width, initial-scale=1',
      },
      favicon: 'src/public/assets/favicon.svg',
      template: 'src/public/index.html',
    }),
    new CopyWebpackPlugin([
      { from: 'src/public/assets/i18n/*.json', to: 'assets/i18n', flatten: true },
      { from: 'src/public/assets/*.ico', to: 'assets', flatten: true }
    ])
  ]
};
