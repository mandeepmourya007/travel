import { createServer } from './server'
import { logger } from './utils/logger'

const PORT = process.env.PORT || 4000

const app = createServer()

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`)
  logger.info(`Health check: http://localhost:${PORT}/health`)
})
