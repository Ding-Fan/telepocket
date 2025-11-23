# Navbar "Glances" Label - Implementation Plan

## Phase 1: Code Review
**Time**: 1 minute

### Steps
1. Locate navigation config file
2. Identify current label
3. Confirm no other files reference this label
4. Review page structure to verify label accuracy

### Validation
- Navigation config found at `config/navigation.ts`
- Current label is "Notes"
- No hardcoded references elsewhere

## Phase 2: Update Label
**Time**: 1 minute

### Steps
1. Open `apps/web/config/navigation.ts`
2. Change line 4: `{ name: 'Notes', ...}` → `{ name: 'Glances', ...}`
3. Verify syntax is correct
4. Save file

### Validation
- Label changed successfully
- No TypeScript errors
- File saved correctly

## Phase 3: Build and Deploy
**Time**: 3 minutes

### Steps
1. Build monorepo with `pnpm build`
2. Verify build succeeds
3. Deploy web app using PM2: `pm2 stop telepocket-web && pm2 start ~/pm2-manager/ecosystem.config.js --only telepocket-web && pm2 save`
4. Check deployment logs

### Validation
- Build completes without errors
- PM2 restart succeeds
- Web app running on port 3013
- No console errors

## Phase 4: Manual Verification
**Time**: (User testing)

### Test Cases
1. **Navbar Display**
   - Open web app
   - Verify navbar shows "Glances"
   - Verify icon is still Home

2. **Navigation**
   - Click "Glances" in navbar
   - Verify navigates to home page
   - Verify URL is `/`

3. **Page Content**
   - Verify page heading shows "Quick Glance"
   - Verify priority section displays
   - Verify category sections display
   - Verify "See All Notes" button present

4. **Full Notes List**
   - Click "See All Notes" button
   - Verify navigates to `/notes`
   - Verify full notes list displays
   - Click "Glances" in navbar to return

### Validation
- All navigation works correctly
- Labels are consistent
- No broken functionality
- User experience improved

## Total Effort
**Estimated**: 5 minutes
**Actual**: 5 minutes
**Status**: ✅ Completed

## Rollback Plan

If issues occur:
```bash
# Revert navigation config
git checkout apps/web/config/navigation.ts

# Rebuild and redeploy
pnpm build
pm2 stop telepocket-web && pm2 start ~/pm2-manager/ecosystem.config.js --only telepocket-web && pm2 save
```
