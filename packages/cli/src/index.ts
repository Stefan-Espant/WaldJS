export { defineConfig, loadWaldConfig } from './config.js'
export type { WaldConfig } from './config.js'
export {
  defineAdapter,
  staticAdapter,
  netlifyAdapter,
  cloudflarePagesAdapter,
  vercelAdapter,
} from './adapters.js'
export type { WaldAdapter, WaldAdapterContext } from './adapters.js'
export { optimizeImage, renderImage, renderImageTag } from './image.js'
export type { ImageContext, ImageProps, OptimizedImage } from './image.js'
