import { useCallback, useEffect, useState } from 'preact/hooks'

import type { IApiClient } from '@frontend/api/client'
import type {
  IAuthStatusDto,
  IPasswordPayload,
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
  error: string
  isSubmitting: boolean
  setPhone(value: string): void
  setCode(value: string): void
  setPassword(value: string): void
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
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const applyStatus = useCallback(
    async (status: IAuthStatusDto) => {
      setStep(status.step)

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
    error,
    isSubmitting,
    setPhone,
    setCode,
    setPassword,
    submitPhone,
    submitCode,
    submitPassword
  }
}
