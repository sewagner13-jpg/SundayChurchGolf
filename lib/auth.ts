import { NextAuthOptions } from 'next-auth'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import EmailProvider from 'next-auth/providers/email'
import { prisma } from './prisma'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
    }),
  ],
  pages: {
    signIn: '/auth/signin',
    verifyRequest: '/auth/verify-request',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub as string

        // Fetch role from database and sync with ADMIN_EMAILS
        const user = await prisma.user.findUnique({
          where: { id: token.sub as string },
        })

        if (user) {
          // Determine if user should be admin based on env var
          const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || []
          const shouldBeAdmin = user.email && adminEmails.includes(user.email)

          // Auto-promote if in ADMIN_EMAILS but not admin in DB
          if (shouldBeAdmin && user.role !== 'ADMIN') {
            await prisma.user.update({
              where: { id: user.id },
              data: { role: 'ADMIN' },
            })
            session.user.role = 'ADMIN'
          } else {
            session.user.role = user.role
          }
        }
      }
      return session
    },
  },
}
