import { lazy } from 'preact/compat'
import type { ComponentType } from 'preact'

export const dynamic = <TProps extends object>(
  factory: () => Promise<{ default: ComponentType<TProps> }>
): ComponentType<TProps> => lazy(factory)
