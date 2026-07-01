module.exports = function (eleventyConfig) {
  eleventyConfig.addCollection('post', function (api) {
    return api.getFilteredByTag('post')
  })

  return {
    dir: {
      input: 'src',
      output: 'dist',
      includes: '_includes',
    },
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk',
  }
}
