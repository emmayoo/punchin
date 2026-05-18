/**
 * media 버킷의 모든 객체를 Storage API로 삭제합니다.
 * (storage.objects 에 대한 직접 DELETE 는 Supabase 에서 차단됩니다.)
 *
 * 사용: pnpm storage:empty
 * 필요 env (.env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";

const BUCKET = "media";
const LIST_LIMIT = 1000;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const serviceRoleKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (.env.local)");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** @param {string} prefix */
async function emptyPrefix(prefix) {
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
      limit: LIST_LIMIT,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) {
      throw error;
    }
    if (!data?.length) {
      break;
    }

    const filePaths = [];
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) {
        filePaths.push(path);
      } else {
        await emptyPrefix(path);
      }
    }

    if (filePaths.length > 0) {
      const { error: removeError } = await supabase.storage.from(BUCKET).remove(filePaths);
      if (removeError) {
        throw removeError;
      }
      console.log(`removed ${filePaths.length} file(s) under "${prefix || "/"}"`);
    }

    if (data.length < LIST_LIMIT) {
      break;
    }
    offset += LIST_LIMIT;
  }
}

try {
  console.log(`Emptying bucket "${BUCKET}" at ${supabaseUrl} ...`);
  await emptyPrefix("");
  console.log("Done.");
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
