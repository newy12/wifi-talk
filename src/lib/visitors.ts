import { getVisitorId } from './identity';
import { supabase } from './supabase';

/** 오늘(한국 시간) 방문을 기록하고 오늘 다녀간 사람 수를 받는다. 같은 기기는 하루 한 번만 센다. */
export async function recordVisit(): Promise<number | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('record_visit', { p_visitor_id: await getVisitorId() });
  return error || typeof data !== 'number' ? null : data;
}
