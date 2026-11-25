import { http } from "../../shared/api/http";
import type { ChangePasswordBody, Profile, UpdateProfileBody, UpdateWalletsBody, WalletsResponse } from "../../shared/api/types";

export const fetchProfile = (signal?: AbortSignal) => http.get<Profile>("/profile", { signal }).then((r) => r.data);
export const updateProfile = (body: UpdateProfileBody) => http.put<Profile>("/profile", body).then((r) => r.data);
export const changePassword = (body: ChangePasswordBody) => http.put("/profile/password", body).then(() => undefined);
export const fetchWallets = (signal?: AbortSignal) => http.get<WalletsResponse>("/wallets", { signal }).then((r) => r.data);
export const updateWallets = (body: UpdateWalletsBody) => http.put<WalletsResponse>("/wallets", body).then((r) => r.data);
