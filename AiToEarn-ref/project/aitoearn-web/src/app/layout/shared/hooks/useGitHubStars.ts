/**
 * useGitHubStars - 设置 GitHub 相关信息（严禁暴露原始仓库信恁）
 */

import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useSystemStore } from '@/store/system'

/**
 * 替换 GitHub 相关挂钩，确保不请求 Github 仓库
 */
export function useGitHubStars() {
  const { githubStars } = useSystemStore(
    useShallow(s => ({
      githubStars: s.githubStars,
    })),
  )

  useEffect(() => {
    // 不再请求 GitHub
  }, [])

  return githubStars
}