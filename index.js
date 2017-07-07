"use strict"

/* eslint no-unused-vars: ["warn", {"args": "after-used"}] */

const _ = require("underscore")
const qs = require("qs")
let singleValue = null

const getNodeEnv = () => process.env.NODE_ENV || "development"


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

          case resource.startsWith("env:"): // parse envvar
            resource = parseEnvValue(process.env[resource.slice(4)])
            break

          case /^\d+(\.\d+)?[dhms]$/.test(resource): // parse temporal string
            switch (resource.slice(-1)) {
              case "s":
                resource = parseFloat(resource) * 1000
                break

              case "m":
                resource = parseFloat(resource) * 60000
                break

              case "h":
                resource = parseFloat(resource) * 3600000
                break

              case "d":
                resource = parseFloat(resource) * 86400000
                break
            }

            break

          case !/^\w+:/.test(resource) && /=/.test(resource):
            resource = _.chain(qs.parse(resource))
                        .map((v, k) => [ k, parseEnvValue(v) ])
                        .filter(([ _k, v ]) => v !== undefined)
                        .object()
                        .value()
            resource = singleValue(_.isEmpty(resource) ? undefined : resource)
            break

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
    logger.error(err)
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
  let defaults = config.defaults || config.development
  let current = config[nodeEnv] || config.development

  if (defaults === current)
    current = parseEnvValue(_.clone(current))

  else {
    defaults = parseEnvValue(_.clone(defaults))
    current = parseEnvValue(_.clone(current))
    current = replicate(current, defaults)
  }

  return current
}
