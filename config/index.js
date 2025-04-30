const dotenv = require("dotenv");

// 只在非生產環境中載入 .env 檔案
if (process.env.NODE_ENV !== "production") {
  const result = dotenv.config();
  if (result.error) {
    throw result.error;
  }
  console.log(".env 檔案已在非生產環境中載入。");
} else {
  console.log("生產環境中使用 Render 環境變數，跳過 .env 檔案載入。");
}

const db = require("./db");
const web = require("./web");
const secret = require("./secret");

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
