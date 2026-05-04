import { Request, Response } from 'express'
import { FirebaseAuthService } from '../services/firebase-auth.service'
import { asyncHandler } from '../utils/async-handler'
import { COOKIE_OPTIONS } from '../utils/constants'

export class FirebaseAuthController {
  constructor(private firebaseAuthService: FirebaseAuthService) {}

  /** POST /auth/firebase/verify — public */
  verifyPhone = asyncHandler(async (req: Request, res: Response) => {
    const { auth, refreshToken, isNewUser } = await this.firebaseAuthService.verifyPhoneToken(
      req.body.idToken,
      { userAgent: req.headers['user-agent'], ip: req.ip },
    )

    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS)
    res.json({ success: true, data: { user: auth.user, tokens: auth.tokens, isNewUser } })
  })
}
