const dotenv = require("dotenv");

const result = dotenv.config();
const db = require("./db");
const web = require("./web");
const secret = require("./secret");

if (result.error) {
  throw result.error;
}
const config = {
  db,
  web,
  secret,
};

class ConfigManager {
  /**
   * Retrieves a configuration value based on the provided dot-separated path.
   * Throws an error if the specified configuration path is not found.
   *
   * @param {string} path - Dot-separated string representing the configuration path.
   * @returns {*} - The configuration value corresponding to the given path.
   * @throws Will throw an error if the configuration path is not found.
   */

  static get(path) {
    if (!path || typeof path !== "string") {
      throw new Error(`incorrect path: ${path}`);
    }
    const keys = path.split(".");
    let configValue = config;
    keys.forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(configValue, key)) {
        throw new Error(`config ${path} not found`);
      }
      configValue = configValue[key];
    });
    return configValue;
  }
}

module.exports = ConfigManager;
