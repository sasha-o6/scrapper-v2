import { KeyRound, LogIn, MessageSquareCode, Phone } from 'lucide-preact'
import { memo } from 'preact/compat'

import type { IUseAuthFlowResult } from '@frontend/hooks/useAuthFlow'
import styles from '@frontend/styles/App.module.scss'

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
        {authFlow.error ? <p className={styles.errorText}>{authFlow.error}</p> : null}
        <button className={styles.primaryButton} type="submit" disabled={authFlow.isSubmitting}>
          <LogIn size={18} />
          <span>{authFlow.isSubmitting ? 'Зачекайте' : 'Продовжити'}</span>
        </button>
      </form>
    </section>
  )
})
