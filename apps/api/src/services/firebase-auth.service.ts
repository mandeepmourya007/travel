import type { Logger } from 'pino'
import type { Auth } from 'firebase-admin/auth'
import type { AuthResponse } from '@shared/types/auth.types'
import { UserRepository } from '../repositories/user.repository'
import { AuthService } from './auth.service'
import { AuthError } from '../errors/app-error'
import { normalizePhone } from '../utils/phone'
import { USER_ROLE, DEFAULT_USER_NAME } from '@shared/constants'

export class FirebaseAuthService {
  constructor(
    private firebaseAuth: Auth,
    private userRepo: UserRepository,
    private authService: AuthService,
    private logger: Logger,
  ) {}

  /**
   * Verifies a Firebase ID token from client-side phone auth.
   * Extracts phone number, finds or creates user, issues app JWT tokens.
   * @throws {AuthError} Invalid token, no phone in token, or deactivated user
   */
  async verifyPhoneToken(
    idToken: string,
    meta: { userAgent?: string; ip?: string },
  ): Promise<{ auth: AuthResponse; refreshToken: string; isNewUser: boolean }> {
    let decoded
    try {
      decoded = await this.firebaseAuth.verifyIdToken(idToken)
    } catch {
      throw new AuthError('Invalid Firebase token')
    }

    const rawPhone = decoded.phone_number
    if (!rawPhone) {
      throw new AuthError('No phone number in Firebase token')
    }

    const phone = normalizePhone(rawPhone)
    if (!phone) {
      throw new AuthError('Invalid phone number in Firebase token')
    }

    let user = await this.userRepo.findByPhone(phone)
    let isNewUser = false

    if (user && !user.isActive) {
      throw new AuthError('Account is deactivated')
    }

    if (!user) {
      user = await this.userRepo.create({
        name: DEFAULT_USER_NAME,
        phone,
        role: USER_ROLE.TRAVELER,
        phoneVerified: true,
      })
      isNewUser = true
      this.logger.info({ userId: user.id }, 'Auto-created user via Firebase phone auth')
    }

    const { auth, refreshToken } = await this.authService.issueTokens(user, meta)

    this.logger.info({ userId: user.id, isNewUser }, 'Firebase phone auth verified')

    return { auth, refreshToken, isNewUser }
  }
}
