import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { connectDB } from './db'
import Tenant from '@/models/Tenant'

// In-memory login attempt rate limiting
const loginAttempts = new Map<string, { count: number; resetTime: number }>()
const MAX_LOGIN_ATTEMPTS = 5
const LOGIN_WINDOW_MS = 15 * 60 * 1000 // 15 minutes

function checkLoginRateLimit(email: string): boolean {
  const now = Date.now()
  const entry = loginAttempts.get(email)
  if (!entry || now > entry.resetTime) {
    loginAttempts.set(email, { count: 1, resetTime: now + LOGIN_WINDOW_MS })
    return true
  }
  entry.count++
  return entry.count <= MAX_LOGIN_ATTEMPTS
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const emailKey = credentials.email.toLowerCase()

        // Rate limit login attempts per email
        if (!checkLoginRateLimit(emailKey)) {
          throw new Error('Too many login attempts. Please try again in 15 minutes.')
        }

        await connectDB()

        const tenant = await Tenant.findOne({ email: emailKey }).select('+password')
        if (!tenant) return null

        const isValid = await bcrypt.compare(credentials.password, tenant.password)
        if (!isValid) return null

        // Reset attempts on successful login
        loginAttempts.delete(emailKey)

        return {
          id: tenant._id.toString(),
          email: tenant.email,
          name: `${tenant.firstName} ${tenant.lastName}`,
          role: tenant.role,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as 'tenant' | 'admin'
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
}
