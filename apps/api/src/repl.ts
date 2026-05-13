import repl from 'node:repl'
import { prisma } from './lib/prisma'
import { emailProvider, authService, walletService, notificationService, chatService } from './config/dependencies'

console.log('\n🚀 Safarnama REPL')
console.log('─'.repeat(40))
console.log('Available globals:')
console.log('  prisma          — Prisma client (await prisma.user.findFirst())')
console.log('  emailProvider   — Send emails (await emailProvider.sendEmail({...}))')
console.log('  authService, walletService, notificationService, chatService')
console.log('─'.repeat(40))
console.log('')

const r = repl.start({ prompt: 'travel> ', useGlobal: true })

Object.assign(r.context, {
  prisma,
  emailProvider,
  authService,
  walletService,
  notificationService,
  chatService,
})

r.on('exit', async () => {
  console.log('\nDisconnecting Prisma...')
  await prisma.$disconnect()
  process.exit(0)
})
