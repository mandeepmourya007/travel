import { Request, Response } from 'express'
import { OtpService } from '../services/otp.service'
import { asyncHandler } from '../utils/async-handler'
import { COOKIE_OPTIONS } from '../utils/constants'

export class OtpController {
  constructor(private otpService: OtpService) {}

  /** POST /auth/otp/send — public */
  sendOtp = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.otpService.sendOtp(req.body.phone)
    res.json({ success: true, data: result })
  })

  /** POST /auth/otp/verify — public */
  verifyOtp = asyncHandler(async (req: Request, res: Response) => {
    const { auth, refreshToken, isNewUser } = await this.otpService.verifyOtp(
      req.body.phone,
      req.body.otp,
      { userAgent: req.headers['user-agent'], ip: req.ip },
    )

    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS)
    res.json({ success: true, data: { user: auth.user, tokens: auth.tokens, isNewUser } })
  })

  /** POST /auth/otp/email/send — public */
  sendEmailOtp = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.otpService.sendEmailOtp(req.body.email)
    res.json({ success: true, data: result })
  })

  /** POST /auth/otp/email/verify — public */
  verifyEmailOtp = asyncHandler(async (req: Request, res: Response) => {
    const { auth, refreshToken, isNewUser } = await this.otpService.verifyEmailOtp(
      req.body.email,
      req.body.otp,
      { userAgent: req.headers['user-agent'], ip: req.ip },
    )

    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS)
    res.json({ success: true, data: { user: auth.user, tokens: auth.tokens, isNewUser } })
  })

  /** POST /auth/otp/attach/send — authenticated — attach a phone to the current session's user */
  sendAttachPhoneOtp = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.otpService.sendPhoneOtpForAttach(req.user!.userId, req.body.phone)
    res.json({ success: true, data: result })
  })

  /**
   * POST /auth/otp/attach/verify — authenticated — session-preserving, never issues
   * tokens or sets a cookie (contrast with the public verifyOtp above).
   */
  verifyAttachPhoneOtp = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.otpService.verifyPhoneOtpForAttach(req.user!.userId, req.body.phone, req.body.otp)
    res.json({ success: true, data: result })
  })
}
