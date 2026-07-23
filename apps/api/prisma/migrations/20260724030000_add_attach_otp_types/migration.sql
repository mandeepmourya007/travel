-- Distinct OTP types for the authenticated "attach phone"/"attach email"
-- flows (profile edit), separate from the public login/signup PHONE_OTP/
-- EMAIL_OTP flows — see OTP_TYPE.ATTACH_PHONE_OTP/ATTACH_EMAIL_OTP.
ALTER TYPE "VerificationCodeType" ADD VALUE 'ATTACH_PHONE_OTP';
ALTER TYPE "VerificationCodeType" ADD VALUE 'ATTACH_EMAIL_OTP';
