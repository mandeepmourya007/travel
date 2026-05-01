import { Request, Response } from 'express'
import { AuthService } from '../services/auth.service'
import { asyncHandler } from '../utils/async-handler'
import { AuthError } from '../errors/app-error'
import { REFRESH_TOKEN_DAYS } from '../utils/constants'

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
  path: '/api/v1/auth',
}

export class AuthController {
  constructor(private authService: AuthService) {}

  signup = asyncHandler(async (req: Request, res: Response) => {
    const { auth, refreshToken } = await this.authService.signup(req.body, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    })

    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS)
    res.status(201).json({ success: true, data: auth })
  })

  login = asyncHandler(async (req: Request, res: Response) => {
    const { auth, refreshToken } = await this.authService.login(req.body, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    })

    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS)
    res.json({ success: true, data: auth })
  })

  refresh = asyncHandler(async (req: Request, res: Response) => {
    const rawToken = req.cookies?.refreshToken
    if (!rawToken) {
      throw new AuthError('No refresh token provided')
    }

    const tokens = await this.authService.refresh(rawToken)
    res.json({ success: true, data: tokens })
  })

  logout = asyncHandler(async (req: Request, res: Response) => {
    const rawToken = req.cookies?.refreshToken
    if (rawToken) {
      await this.authService.logout(rawToken)
    }

    res.clearCookie('refreshToken', { path: '/api/v1/auth' })
    res.json({ success: true, data: { message: 'Logged out successfully' } })
  })

  logoutAll = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new AuthError('Not authenticated')
    await this.authService.logoutAll(req.user.userId)

    res.clearCookie('refreshToken', { path: '/api/v1/auth' })
    res.json({ success: true, data: { message: 'All sessions revoked' } })
  })

  getMe = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new AuthError('Not authenticated')
    const user = await this.authService.getMe(req.user.userId)
    res.json({ success: true, data: user })
  })
}
