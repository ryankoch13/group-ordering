import { supabase } from "@/lib/supabase";

export type ActiveGroupOrder = {
  id: string;
  name: string | null;
  hostUserId: string | null;
  isHost: boolean;
};

async function withTimeout<T>(
  promise: PromiseLike<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export async function getActiveGroupOrder(): Promise<ActiveGroupOrder | null> {
  const authResult = await withTimeout(
    supabase.auth.getUser(),
    8000,
    "Auth lookup",
  );

  if (authResult.error) {
    throw authResult.error;
  }

  const userId = authResult.data.user?.id;

  if (!userId) {
    return null;
  }

  const hostedResult = await withTimeout(
    supabase
      .from("group_orders")
      .select("id, name, host_user_id, status, checked_out_at")
      .eq("host_user_id", userId)
      .is("checked_out_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    8000,
    "Hosted group order lookup",
  );

  if (hostedResult.error) {
    throw hostedResult.error;
  }

  if (hostedResult.data) {
    return {
      id: hostedResult.data.id,
      name: hostedResult.data.name,
      hostUserId: hostedResult.data.host_user_id,
      isHost: true,
    };
  }

  const memberResult = await withTimeout(
    supabase
      .from("group_members")
      .select("group_order_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    8000,
    "Group member lookup",
  );

  if (memberResult.error) {
    throw memberResult.error;
  }

  const groupOrderId = memberResult.data?.group_order_id;

  if (!groupOrderId) {
    return null;
  }

  const groupResult = await withTimeout(
    supabase
      .from("group_orders")
      .select("id, name, host_user_id, status, checked_out_at")
      .eq("id", groupOrderId)
      .is("checked_out_at", null)
      .maybeSingle(),
    8000,
    "Member group order lookup",
  );

  if (groupResult.error) {
    throw groupResult.error;
  }

  if (!groupResult.data) {
    return null;
  }

  return {
    id: groupResult.data.id,
    name: groupResult.data.name,
    hostUserId: groupResult.data.host_user_id,
    isHost: groupResult.data.host_user_id === userId,
  };
}
