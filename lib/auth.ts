import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import FacebookProvider from 'next-auth/providers/facebook'
import AppleProvider from 'next-auth/providers/apple'
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

// Split full name into first/last best-effort
function splitName(name: string): { firstName: string; lastName: string } {
  const parts = (name ?? '').trim().split(/\s+/)
  const firstName = parts[0] ?? 'Unknown'
  const lastName = parts.slice(1).join(' ') || '-'
  return { firstName, lastName }
}

export const authOptions: NextAuthOptions = {
  providers: [
    // ─── Credentials ──────────────────────────────────────────────────────────
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const emailKey = credentials.email.toLowerCase()

        if (!checkLoginRateLimit(emailKey)) {
          throw new Error('Too many login attempts. Please try again in 15 minutes.')
        }

        await connectDB()

        const tenant = await Tenant.findOne({ email: emailKey }).select('+password')
        if (!tenant) return null

        const isValid = await bcrypt.compare(credentials.password, tenant.password)
        if (!isValid) return null

        loginAttempts.delete(emailKey)

        return {
          id: tenant._id.toString(),
          email: tenant.email,
          name: `${tenant.firstName} ${tenant.lastName}`,
          role: tenant.role,
        }
      },
    }),

    // ─── Google ───────────────────────────────────────────────────────────────
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),

    // ─── Facebook ─────────────────────────────────────────────────────────────
    ...(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET
      ? [
          FacebookProvider({
            clientId: process.env.FACEBOOK_CLIENT_ID,
            clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
          }),
        ]
      : []),

    // ─── Apple ────────────────────────────────────────────────────────────────
    ...(process.env.APPLE_ID && process.env.APPLE_SECRET
      ? [
          AppleProvider({
            clientId: process.env.APPLE_ID,
            clientSecret: process.env.APPLE_SECRET,
          }),
        ]
      : []),
  ],

  callbacks: {
    async signIn({ user, account }) {
      // Social login: find or create tenant
      if (account?.provider && account.provider !== 'credentials') {
        if (!user.email) return false

        await connectDB()

        const existing = await Tenant.findOne({ email: user.email.toLowerCase() })

        if (!existing) {
          const { firstName, lastName } = splitName(user.name ?? '')
          // Create a tenant with a random unusable password (social login only)
          const randomPassword = await bcrypt.hash(Math.random().toString(36), 12)
          await Tenant.create({
            email: user.email.toLowerCase(),
            firstName,
            lastName,
            phone: '',
            password: randomPassword,
            role: 'tenant',
            status: 'active',
            autopayEnabled: false,
            smsOptIn: false,
          })
        }

        return true
      }

      return true
    },

    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role?: string }).role ?? 'tenant'
      }

      // For social logins, fetch role from DB
      if (account?.provider && account.provider !== 'credentials' && token.email) {
        await connectDB()
        const tenant = await Tenant.findOne({ email: token.email.toLowerCase() })
        if (tenant) {
          token.id = tenant._id.toString()
          token.role = tenant.role
        }
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
