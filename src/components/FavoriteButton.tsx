import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Heart } from 'lucide-react'
import { api } from '../lib/api'
import { sessionToken, sessionUserId } from '../lib/session'

export function FavoriteButton({ nftId, label, className = '' }: { nftId: string; label: string; className?: string }) {
  const client = useQueryClient()
  const key = ['favorites', sessionUserId()]
  const favorites = useQuery({ queryKey: key, queryFn: async () => (await api.get<{ items: string[] }>('/favorites')).data.items, enabled: Boolean(sessionToken()), staleTime: 15000 })
  const mutation = useMutation({
    mutationFn: (next: boolean) => {
      const scenario = new URLSearchParams(window.location.search).get('scenario')
      const config = scenario === 'favorite-failure' ? { headers: { 'X-Mock-Scenario': scenario } } : undefined
      return next ? api.post(`/favorites/${encodeURIComponent(nftId)}`, {}, config) : api.delete(`/favorites/${encodeURIComponent(nftId)}`, config)
    },
    onMutate: async (next) => {
      await client.cancelQueries({ queryKey: key })
      const previous = client.getQueryData<string[]>(key) ?? []
      client.setQueryData<string[]>(key, next ? [...new Set([...previous, nftId])] : previous.filter((id) => id !== nftId))
      return { previous }
    },
    onError: (_error, _next, context) => { if (context) client.setQueryData(key, context.previous) },
    onSettled: () => client.invalidateQueries({ queryKey: key }),
  })
  const active = favorites.data?.includes(nftId) ?? false
  return <><button type="button" className={`${className} favorite-button`} aria-label={`${active ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}: ${label}`} aria-pressed={active} disabled={mutation.isPending} onClick={() => { if (!sessionToken()) { window.location.assign(`/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`); return } mutation.mutate(!active) }}><Heart size={16} fill={active ? 'currentColor' : 'none'} aria-hidden="true" /></button>{mutation.isError && <span role="status" className="favorite-error">Não foi possível atualizar os favoritos. Tente novamente.</span>}</>
}
