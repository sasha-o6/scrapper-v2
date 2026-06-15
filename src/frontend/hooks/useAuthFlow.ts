import { useCallback, useEffect, useState } from 'preact/hooks'

import type { IApiClient } from '@frontend/api/client'
import type {
  IAuthCodeDeliveryDto,
  IAuthStatusDto,
  IPasswordPayload,
  IResendCodePayload,
  ISendCodePayload,
  ISignInPayload,
  TAuthStep
} from '@shared/types'

interface IUseAuthFlowParams {
  apiClient: IApiClient
  onAuthorized(): Promise<void>
}

export interface IUseAuthFlowResult {
  step: TAuthStep
  phone: string
  code: string
  password: string
  codeDelivery: IAuthCodeDeliveryDto | null
  error: string
  isSubmitting: boolean
  isResending: boolean
  resendSecondsLeft: number
  setPhone(value: string): void
  setCode(value: string): void
  setPassword(value: string): void
  returnToPhone(): void
  resendCode(): Promise<void>
  submitPhone(): Promise<void>
  submitCode(): Promise<void>
  submitPassword(): Promise<void>
}

export const useAuthFlow = ({
  apiClient,
  onAuthorized
}: IUseAuthFlowParams): IUseAuthFlowResult => {
  const [step, setStep] = useState<TAuthStep>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [codeDelivery, setCodeDelivery] = useState<IAuthCodeDeliveryDto | null>(null)
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResending, setIsResending] = useState(false)

  const applyStatus = useCallback(
    async (status: IAuthStatusDto) => {
      setStep(status.step)

      if (status.step === 'code' && status.codeDelivery) {
        const nextNow = Date.now()
        setNow(nextNow)
        setCodeDelivery(status.codeDelivery)
        setResendAvailableAt(
          status.codeDelivery.timeoutSeconds > 0
            ? nextNow + status.codeDelivery.timeoutSeconds * 1000
            : null
        )
      }

      if (status.step !== 'code') {
        setCodeDelivery(null)
        setResendAvailableAt(null)
      }

      if (status.isAuthorized) {
        await onAuthorized()
      }
    },
    [onAuthorized]
  )

  const submit = useCallback(
    async <TPayload extends object>(
      path: string,
      payload: TPayload
    ): Promise<IAuthStatusDto> => {
      setIsSubmitting(true)
      setError('')

      try {
        const status = await apiClient.post<IAuthStatusDto, TPayload>(path, payload)
        await applyStatus(status)

        return status
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : 'Помилка авторизації')
        throw submitError
      } finally {
        setIsSubmitting(false)
      }
    },
    [apiClient, applyStatus]
  )

  const submitPhone = useCallback(
    async () => {
      setCode('')
      setPassword('')
      await submit<ISendCodePayload>('/auth/send-code', { phone })
    },
    [phone, submit]
  )

  const submitCode = useCallback(
    async () => {
      await submit<ISignInPayload>('/auth/sign-in', { code })
    },
    [code, submit]
  )

  const submitPassword = useCallback(
    async () => {
      await submit<IPasswordPayload>('/auth/check-password', { password })
    },
    [password, submit]
  )

  const resendCode = useCallback(async () => {
    setIsResending(true)
    setError('')

    try {
      const status = await apiClient.post<IAuthStatusDto, IResendCodePayload>(
        '/auth/resend-code',
        {}
      )
      await applyStatus(status)
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : 'Не вдалося надіслати код')
      throw resendError
    } finally {
      setIsResending(false)
    }
  }, [apiClient, applyStatus])

  const returnToPhone = useCallback(() => {
    setStep('phone')
    setCode('')
    setPassword('')
    setCodeDelivery(null)
    setResendAvailableAt(null)
    setError('')
  }, [])

  useEffect(() => {
    if (!resendAvailableAt) {
      return undefined
    }

    const intervalId = setInterval(() => {
      const nextNow = Date.now()
      setNow(nextNow)

      if (nextNow >= resendAvailableAt) {
        setResendAvailableAt(null)
      }
    }, 1000)

    return () => clearInterval(intervalId)
  }, [resendAvailableAt])

  useEffect(() => {
    let isMounted = true

    apiClient
      .get<IAuthStatusDto>('/auth/status')
      .then((status) => {
        if (isMounted) {
          void applyStatus(status)
        }
      })
      .catch(() => {
        if (isMounted) {
          setStep('phone')
        }
      })

    return () => {
      isMounted = false
    }
  }, [apiClient, applyStatus])

  return {
    step,
    phone,
    code,
    password,
    codeDelivery,
    error,
    isSubmitting,
    isResending,
    resendSecondsLeft: resendAvailableAt
      ? Math.max(0, Math.ceil((resendAvailableAt - now) / 1000))
      : 0,
    setPhone,
    setCode,
    setPassword,
    returnToPhone,
    resendCode,
    submitPhone,
    submitCode,
    submitPassword
  }
}
