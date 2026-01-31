// @ts-ignore
export function addBetaTester(supabase, user_id) {
    return supabase
        .from('beta_tester')
        .upsert({ user_id: user_id, accepted: true }, { onConflict: 'user_id' })
        .select()
        .single();
}
