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
}
