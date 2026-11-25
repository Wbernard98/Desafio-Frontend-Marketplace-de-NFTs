import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ownerOf, useAuthState } from "../../shared/auth/authStore";
import { keys } from "../../shared/api/queryKeys";
import { changePassword, fetchProfile, fetchWallets, updateProfile, updateWallets } from "./api";

export function useProfile() {
  const auth = useAuthState();
  return useQuery({ queryKey: keys.profile(ownerOf(auth)), queryFn: ({ signal }) => fetchProfile(signal), enabled: !!auth.token });
}
export function useUpdateProfile() {
  const qc = useQueryClient();
  const owner = ownerOf(useAuthState());
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: (profile) => {
      qc.setQueryData(keys.profile(owner), profile);
      void qc.invalidateQueries({ queryKey: keys.session(owner) }); // nome no cabeçalho
    },
  });
}
export const useChangePassword = () => useMutation({ mutationFn: changePassword });

export function useWallets() {
  const auth = useAuthState();
  return useQuery({ queryKey: keys.wallets(ownerOf(auth)), queryFn: ({ signal }) => fetchWallets(signal), enabled: !!auth.token });
}
export function useUpdateWallets() {
  const qc = useQueryClient();
  const owner = ownerOf(useAuthState());
  return useMutation({
    mutationFn: updateWallets,
    onSuccess: (wallets) => {
      qc.setQueryData(keys.wallets(owner), wallets);
      qc.setQueryData(keys.connection(owner), null); // carteiras mudaram: nova conexão necessária
    },
  });
}
