"use strict"

/* eslint no-unused-vars: ["warn", {"args": "after-used"}] */
/* eslint no-console: 0 */

const _ = require("underscore")
const qs = require("qs")
const duration = require("iso8601-duration")
let singleValue = null

const getNodeEnv = () => process.env.NODE_ENV || "development"

// Woraround duration.default.pattern issue
const durationPattern = new RegExp(
  `^${duration.default.pattern.toString().slice(1, -1)}$`
)


function replicate(destination, source) {
  if (destination === undefined || destination === source)
    return source

  if (_.isObject(destination))
    for (const attr in source)
      if (destination[attr] === undefined)
        destination[attr] = source[attr]

  return destination
}


function parseEnvValue(resource) {
  if (typeof resource === "string")
    try { resource = JSON.parse(resource) }
    catch(_err) {}

  try {
    switch (typeof resource) {
      //------------------------------------------------------------------------
      case "string":
        switch (true) {
          case resource.trim() === "": // empty string
            break

          case resource.startsWith("raw:"): // raw string
            resource = resource.slice(4)
            break

          case resource.startsWith("env:"): // parse envvar
            resource = parseEnvValue(process.env[resource.slice(4)])
            break

          case durationPattern.test(resource): // ISO-8601 duration
            resource = duration.toSeconds(duration.parse(resource)) * 1000
            break

          case /^\w+(\[\w*\])?=([^&]*)?(&\w+(\[\w*\])?=([^&]*)?)*$/
              .test(resource):
            resource = _.chain(qs.parse(resource))
                        .map((v, k) => [ k, parseEnvValue(v) ])
                        .filter(([ _k, v ]) => v !== undefined)
                        .object()
                        .value()
            resource = singleValue(_.isEmpty(resource) ? undefined : resource)
            break

          // TODO: parse ISO-8601 date/time
          // TODO: nested keys
          // TODO: regex
          default:
            // Take what you got
            break
        }

        break

      //------------------------------------------------------------------------
      case "object":
        switch (true) {
          case _.isEmpty(resource):
            // null, empty arrays, empty objects: do nothing
            break

          case Array.isArray(resource):
            resource = resource.map(e => parseEnvValue(e))
            break

          /*
           * Other cases go here
           */

          default:
            resource = _.chain(resource)
                        .map((v, k) => [ k, parseEnvValue(v) ])
                        .object()
                        .value()
        }

        break

      /*------------------------------------------------------------------------
       * case other:
       *   goes here
       */

      //------------------------------------------------------------------------
      default:
        // Take what you got
        break
    }

  } catch(err) {
    console.error(err)
  }

  return resource
}


singleValue = value =>
  (
    (_.keys(value).length === 1)
    && _.chain(value).values().first().value() === ""
  ) ? parseEnvValue(_.chain(value).keys().first().value())
    : value


module.exports = (config, nodeEnv) => {
  nodeEnv = nodeEnv || getNodeEnv()
  const { defaults, development } = config
  let current = config[nodeEnv] || development
  current = _.isUndefined(current) ? development : current
  current = _.isUndefined(current) ? defaults : current

  if (defaults === current)
    current = parseEnvValue(_.clone(current))

  else
    current = replicate(
      parseEnvValue(_.clone(current)),
      parseEnvValue(_.clone(defaults))
    )

  return current
}
