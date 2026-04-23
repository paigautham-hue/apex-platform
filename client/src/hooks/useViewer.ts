/**
 * useViewer — universal hook for resolving the current viewer's fractal scope.
 * Every page that adapts based on role should call this once.
 */
import { trpc } from "@/lib/trpc";

export type ViewerTier = "CHAIRMAN" | "GROUP_CEO" | "CEO" | "CXO" | "MEMBER";
export type LandingPath = "me" | "team" | "group" | "today";

export function useViewer() {
  const query = trpc.scope.getViewer.useQuery(undefined, {
    staleTime: 60_000,
    retry: 1,
  });
  return {
    viewer: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function tierLabel(tier?: ViewerTier | null): string {
  if (!tier) return "";
  switch (tier) {
    case "CHAIRMAN":
      return "Chairman";
    case "GROUP_CEO":
      return "Group CEO";
    case "CEO":
      return "CEO";
    case "CXO":
      return "CXO";
    case "MEMBER":
      return "Member";
  }
}

export function canAccessTeamView(tier?: ViewerTier | null, hasReports?: boolean) {
  if (!tier) return false;
  if (tier === "CHAIRMAN" || tier === "GROUP_CEO") return true;
  return Boolean(hasReports);
}

export function canAccessGroupView(tier?: ViewerTier | null, isFundWide?: boolean) {
  if (isFundWide) return true;
  return tier === "CHAIRMAN" || tier === "GROUP_CEO" || tier === "CEO";
}
