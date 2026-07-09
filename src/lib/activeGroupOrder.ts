import { supabase } from "@/lib/supabase";

export type ActiveGroupOrder = {
  id: string;
  name: string | null;
  hostUserId: string | null;
  isHost: boolean;
};

type GroupOrderRow = {
  id: string;
  name: string | null;
  host_user_id: string | null;
  checked_out_at: string | null;
};

type GroupMemberRow = {
  id: string;
  group_order_id: string;
  user_id: string | null;
  status: string | null;
};

async function getCurrentUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  return user?.id ?? null;
}

export async function getActiveGroupOrder(): Promise<ActiveGroupOrder | null> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return null;
  }

  const hostedGroupOrder = await getHostedActiveGroupOrder(userId);

  if (hostedGroupOrder) {
    return {
      id: hostedGroupOrder.id,
      name: hostedGroupOrder.name,
      hostUserId: hostedGroupOrder.host_user_id,
      isHost: true,
    };
  }

  const memberGroupOrder = await getMemberActiveGroupOrder(userId);

  if (!memberGroupOrder) {
    return null;
  }

  return {
    id: memberGroupOrder.id,
    name: memberGroupOrder.name,
    hostUserId: memberGroupOrder.host_user_id,
    isHost: memberGroupOrder.host_user_id === userId,
  };
}

async function getHostedActiveGroupOrder(
  userId: string,
): Promise<GroupOrderRow | null> {
  const { data, error } = await supabase
    .from("group_orders")
    .select("id, name, host_user_id, checked_out_at")
    .eq("host_user_id", userId)
    .is("checked_out_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as GroupOrderRow | null) ?? null;
}

async function getMemberActiveGroupOrder(
  userId: string,
): Promise<GroupOrderRow | null> {
  const { data: memberRow, error: memberError } = await supabase
    .from("group_members")
    .select("id, group_order_id, user_id, status")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (memberError) {
    throw memberError;
  }

  const typedMemberRow = (memberRow as GroupMemberRow | null) ?? null;

  if (!typedMemberRow?.group_order_id) {
    return null;
  }

  const { data: groupOrderRow, error: groupOrderError } = await supabase
    .from("group_orders")
    .select("id, name, host_user_id, checked_out_at")
    .eq("id", typedMemberRow.group_order_id)
    .is("checked_out_at", null)
    .maybeSingle();

  if (groupOrderError) {
    throw groupOrderError;
  }

  return (groupOrderRow as GroupOrderRow | null) ?? null;
}
