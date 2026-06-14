import { useMemo } from 'preact/hooks'

import { createApiClient, type IApiClient } from '@frontend/api/client'

export const useApiClient = (initData: string): IApiClient =>
  useMemo(() => createApiClient(initData), [initData])
