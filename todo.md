# Avatar Shop Completion

## Style Rule
All avatar images MUST match initial character style:
- Child/young adventurer body proportions (NOT adult)
- Goggle-equipped hat/headgear
- Bright, energetic expressions (can vary per character)
- Fantasy RPG adventure gear
- Transparent/simple background

## Phase 1: Icon Images (face close-up, 5 costumes)
- [ ] Knight icon
- [ ] Mage icon
- [ ] Ninja icon
- [ ] Dragon Rider icon
- [ ] Fairy icon

## Phase 2: Full-body Images (5 costumes)
- [ ] Knight full
- [ ] Mage full
- [ ] Ninja full
- [ ] Dragon Rider full
- [ ] Fairy full

## Phase 3: Code Updates
- [ ] Update IMAGES constants with new URLs
- [ ] Update types/stores for costume-based avatar
- [ ] Update ShopPage with purchase/equip flow
- [ ] Update Header to show equipped costume
- [ ] Update HomePage to show equipped costume
- [ ] Verify build passes

## Phase 4: Deploy
- [ ] Save checkpoint
- [ ] Deploy

---

# Phase B1 — 招待コード管理（保護者ダッシュボード）後始末

## 本番公開前に必ず実施（spec v6 §17「Supabase RLS 設定」の一環）

- [ ] `admin_create_invite_code` / `admin_delete_invite_code` / `admin_regenerate_invite_code` の SECURITY DEFINER 厳格化
  - 関数内で `auth.jwt() ->> 'role' = 'admin'` を検証し、違反時は例外 or `{success:false,error:'forbidden'}` を返す
- [ ] anon ロールの EXECUTE 権限を剥奪
  - `REVOKE EXECUTE ON FUNCTION admin_create_invite_code(...) FROM anon;`（他 2 関数も同様）
- [ ] `parent_invite_codes` に RLS ポリシーを張る
  - admin ロールのみ SELECT/INSERT/UPDATE/DELETE 可、anon は拒否
  - View `parent_invite_codes_with_status` にも同等の制限が伝播するか検証
- [ ] `invite_code_logs` に RLS ポリシーを張る
  - admin ロールのみ SELECT 可、書込は SECURITY DEFINER 経由のみ
- [ ] LIFF ID 実値投入（`VITE_LIFF_ID_PARENT`）で LINE 共有の URL が実リンクに切り替わることを確認
  - Render.com 環境変数にも同値を登録

---

# Phase C — 週次レポート 後始末

## 本番公開前に必ず実施

- [ ] Edge Function `generate-weekly-report` の CORS 設定を具体ドメインへ絞る
  - 現状 `Access-Control-Allow-Origin: '*'`（開発優先）
  - `supabase/functions/_shared/supabase-client.ts` の `corsHeaders` を
    `https://trail-quest-world.onrender.com` に置換（または環境変数 ALLOWED_ORIGIN 経由）
  - プレビュー環境がある場合は allowlist 方式（`req.headers.get('origin')` をホワイトリスト照合）を検討
- [ ] `admin_generate_weekly_report` / `aggregate_weekly_data` の
  SECURITY DEFINER を Supabase Auth の role claim で厳格化、anon EXECUTE 剥奪
- [ ] `weekly_reports` の RLS ポリシー設計（保護者は自分の子のみ読取可、kk は全件可）
