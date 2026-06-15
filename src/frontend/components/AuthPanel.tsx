import {
  ArrowLeft,
  KeyRound,
  LogIn,
  MessageSquareCode,
  Phone,
  RefreshCw
} from 'lucide-preact'
import { memo } from 'preact/compat'

import type { IUseAuthFlowResult } from '@frontend/hooks/useAuthFlow'
import styles from '@frontend/styles/App.module.scss'
import type { TAuthCodeDeliveryType, TAuthCodeNextType } from '@shared/types'

export interface IAuthPanelProps {
  authFlow: IUseAuthFlowResult
}

const getStepMeta = (step: IUseAuthFlowResult['step']) => {
  if (step === 'code') {
    return {
      icon: <MessageSquareCode size={18} />,
      label: 'Код з Telegram',
      valueKey: 'code' as const,
      inputType: 'text',
      placeholder: '12345'
    }
  }

  if (step === 'password') {
    return {
      icon: <KeyRound size={18} />,
      label: '2FA пароль',
      valueKey: 'password' as const,
      inputType: 'password',
      placeholder: 'Пароль'
    }
  }

  return {
    icon: <Phone size={18} />,
    label: 'Телефон',
    valueKey: 'phone' as const,
    inputType: 'tel',
    placeholder: '+380...'
  }
}

const DELIVERY_LABELS: Record<TAuthCodeDeliveryType, string> = {
  app: 'Telegram app',
  sms: 'SMS',
  call: 'дзвінок',
  flash_call: 'flash call',
  missed_call: 'пропущений дзвінок',
  email: 'email',
  email_required: 'email',
  fragment: 'Fragment',
  firebase: 'Firebase',
  sms_word: 'SMS',
  sms_phrase: 'SMS',
  success: 'готово'
}

const RESEND_LABELS: Partial<Record<TAuthCodeNextType, string>> = {
  sms: 'Надіслати SMS',
  call: 'Запросити дзвінок',
  flash_call: 'Запросити flash call',
  missed_call: 'Запросити дзвінок',
  fragment: 'Надіслати ще раз',
  firebase: 'Надіслати ще раз',
  sms_word: 'Надіслати SMS',
  sms_phrase: 'Надіслати SMS'
}

const getCodeDeliveryText = (authFlow: IUseAuthFlowResult): string => {
  const delivery = authFlow.codeDelivery

  if (!delivery) {
    return 'Перевір Telegram акаунт цього номера.'
  }

  const codeLength = delivery.length > 0 ? `, ${delivery.length} знаків` : ''

  if (delivery.type === 'app') {
    return `Код надіслано в Telegram акаунт цього номера${codeLength}.`
  }

  return `Код надіслано: ${DELIVERY_LABELS[delivery.type]}${codeLength}.`
}

const getResendButtonText = (authFlow: IUseAuthFlowResult): string => {
  if (authFlow.resendSecondsLeft > 0) {
    return `Повторити через ${authFlow.resendSecondsLeft} с`
  }

  const nextType = authFlow.codeDelivery?.nextType

  if (!nextType) {
    return 'Надіслати ще раз'
  }

  if (nextType === 'none') {
    return 'Повтор недоступний'
  }

  return RESEND_LABELS[nextType] ?? 'Надіслати ще раз'
}

export const AuthPanel = memo(({ authFlow }: IAuthPanelProps) => {
  const meta = getStepMeta(authFlow.step)
  const value = authFlow[meta.valueKey]
  const setValue =
    meta.valueKey === 'phone'
      ? authFlow.setPhone
      : meta.valueKey === 'code'
        ? authFlow.setCode
        : authFlow.setPassword
  const submit =
    authFlow.step === 'code'
      ? authFlow.submitCode
      : authFlow.step === 'password'
        ? authFlow.submitPassword
        : authFlow.submitPhone

  return (
    <section className={styles.authPanel}>
      <div className={styles.sectionHeader}>
        <h2>Авторизація Telegram</h2>
        <span>MTProto</span>
      </div>
      <form
        className={styles.authForm}
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <label className={styles.field}>
          <span>{meta.label}</span>
          <div className={styles.inputWithIcon}>
            {meta.icon}
            <input
              className={styles.input}
              type={meta.inputType}
              value={value}
              placeholder={meta.placeholder}
              onInput={(event) => setValue(event.currentTarget.value)}
            />
          </div>
        </label>
        {authFlow.step === 'code' ? (
          <p className={styles.hintText}>{getCodeDeliveryText(authFlow)}</p>
        ) : null}
        {authFlow.error ? <p className={styles.errorText}>{authFlow.error}</p> : null}
        <div className={styles.authActions}>
          {authFlow.step !== 'phone' ? (
            <button
              className={styles.secondaryButton}
              type="button"
              disabled={authFlow.isSubmitting}
              onClick={authFlow.returnToPhone}
            >
              <ArrowLeft size={18} />
              <span>Змінити номер</span>
            </button>
          ) : null}
          {authFlow.step === 'code' ? (
            <button
              className={styles.secondaryButton}
              type="button"
              disabled={
                authFlow.isSubmitting ||
                authFlow.isResending ||
                authFlow.resendSecondsLeft > 0 ||
                authFlow.codeDelivery?.nextType === 'none'
              }
              onClick={() => void authFlow.resendCode()}
            >
              <RefreshCw size={18} />
              <span>{authFlow.isResending ? 'Надсилання' : getResendButtonText(authFlow)}</span>
            </button>
          ) : null}
          <button className={styles.primaryButton} type="submit" disabled={authFlow.isSubmitting}>
            <LogIn size={18} />
            <span>{authFlow.isSubmitting ? 'Зачекайте' : 'Продовжити'}</span>
          </button>
        </div>
      </form>
    </section>
  )
})
