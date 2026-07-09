import { useCallback, useEffect, useState } from "react";

import { getActiveGroupOrderForCurrentUser } from "@/lib/groups";
import { useGroupOrderStore } from "@/store/groupOrderStore";

export function useActiveGroupOrderSync() {
  const setActiveGroup = useGroupOrderStore((state) => state.setActiveGroup);
  const clearActiveGroup = useGroupOrderStore(
    (state) => state.clearActiveGroup,
  );

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshActiveGroup = useCallback(async () => {
    try {
      setErrorMessage(null);

      const { group, currentUserId } =
        await getActiveGroupOrderForCurrentUser();

      if (group && currentUserId) {
        setActiveGroup(group, currentUserId);
      } else {
        clearActiveGroup();
      }
    } catch (error) {
      console.log("ACTIVE GROUP ERROR:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load active group order.",
      );
    } finally {
      setLoading(false);
    }
  }, [clearActiveGroup, setActiveGroup]);

  useEffect(() => {
    refreshActiveGroup();
  }, [refreshActiveGroup]);

  return {
    loading,
    errorMessage,
    refreshActiveGroup,
  };
}
