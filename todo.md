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
