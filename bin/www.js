#!/usr/bin/env node

/**
 * Module dependencies.
 */
const http = require('http')
const config = require('../config/index')
const app = require('../app') // 導入 app.js
const logger = require('../utils/logger')('www')
const { dataSource } = require('../db/data-source')
const cron = require('node-cron')
const { cleanExpiredPendingOrders } = require('../utils/cleanExpiredPendingOrders')

const port = config.get('web.port')

app.set('port', port)

const server = http.createServer(app)

function onError (error) {
  if (error.syscall !== 'listen') {
    throw error
  }
  const bind = typeof port === 'string'
    ? `Pipe ${port}`
    : `Port ${port}`
  // handle specific listen errors
  switch (error.code) {
    case 'EACCES':
      logger.error(`${bind} requires elevated privileges`)
      process.exit(1)
      break
    case 'EADDRINUSE':
      logger.error(`${bind} is already in use`)
      process.exit(1)
      break
    default:
      logger.error(`exception on ${bind}: ${error.code}`)
      process.exit(1)
  }
}

server.on('error', onError)
server.listen(port, async () => {
  try {
    await dataSource.initialize()
    logger.info('資料庫連線成功')
    logger.info(`伺服器運作中. port: ${port}`)
    await cleanExpiredPendingOrders()
    //排程每天0點0分0秒清除過期暫存訂單
    cron.schedule('0 0 0 * * *', async ()=>{
      logger.info('執行排程任務 : 清除過期暫存訂單')
      await cleanExpiredPendingOrders();
    })
  } catch (error) {
    logger.error(`資料庫連線失敗: ${error.message}`)
    process.exit(1)
  }
})
