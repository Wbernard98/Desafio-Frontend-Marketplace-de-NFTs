import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ownerOf, useAuthState } from "../../shared/auth/authStore";
import { keys } from "../../shared/api/queryKeys";
import { toApiError } from "../../shared/api/errors";
import { announce } from "../../shared/ui/announcer";
import { addFavorite, fetchFavorites, removeFavorite, type FavoritesResponse } from "./api";

export function useFavorites() {
  const auth = useAuthState();
  return useQuery({
    queryKey: keys.favorites(ownerOf(auth)),
    queryFn: ({ signal }) => fetchFavorites(signal),
    enabled: !!auth.token,
  });
}

/** Favoritar com atualização otimista; se a API falhar, o estado anterior é restaurado (rollback). */
export function useToggleFavorite() {
  const qc = useQueryClient();
  const owner = ownerOf(useAuthState());
  return useMutation({
    mutationFn: ({ nftId, favorite }: { nftId: string; favorite: boolean; name: string }) => (favorite ? addFavorite(nftId) : removeFavorite(nftId)),
    onMutate: async ({ nftId, favorite }) => {
      await qc.cancelQueries({ queryKey: keys.favorites(owner) });
      const previous = qc.getQueryData<FavoritesResponse>(keys.favorites(owner));
      const base = previous?.nftIds ?? [];
      qc.setQueryData<FavoritesResponse>(keys.favorites(owner), {
        nftIds: favorite ? Array.from(new Set([...base, nftId])) : base.filter((i) => i !== nftId),
      });
      return { previous };
    },
    onError: (error, vars, ctx) => {
      qc.setQueryData(keys.favorites(owner), ctx?.previous);
      announce(`Não foi possível atualizar os favoritos de ${vars.name}. ${toApiError(error).message}`, "assertive");
    },
    onSuccess: (data, vars) => {
      qc.setQueryData(keys.favorites(owner), data);
      announce(vars.favorite ? `${vars.name} foi adicionado aos favoritos.` : `${vars.name} foi removido dos favoritos.`);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: keys.favorites(owner) }),
  });
}
