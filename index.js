"use strict"

/* eslint no-unused-vars: ["warn", {"args": "after-used"}] */
/* eslint no-console: 0 */

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


function dealWithData(resource) {
  switch (resource.slice(-1)) {
    case "s":
      return parseFloat(resource) * 1000

    case "m":
      return parseFloat(resource) * 60000

    case "h":
      return parseFloat(resource) * 3600000

    case "d":
      return parseFloat(resource) * 86400000

    default:
      return resource
  }
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

          case /^(\d+(\.\d+)?[dhms])+$/.test(resource): // parse temporal string
            {
              let sum = 0
              while ((
                resource = resource.replace(
                  /\d+(\.\d+)?[dhms]/,
                  m => {
                    sum += dealWithData(m)
                    return ""
                  }
                )
              ) !== "") {}
              resource = sum
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
